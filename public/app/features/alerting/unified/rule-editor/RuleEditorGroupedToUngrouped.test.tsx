import { HttpResponse } from 'msw';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import {
  echoBodyResolver,
  getErrorResponse,
  setFolderResponse,
  setGrafanaRulerRuleGroupResolver,
  setReplaceGrafanaRuleResolver,
} from 'app/features/alerting/unified/mocks/server/configure';
import { DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockDataSource, mockFolder } from '../mocks';
import { grafanaRulerGroup, grafanaRulerRule, mockPreviewApiResponse } from '../mocks/grafanaRulerApi';
import { MIMIR_DATASOURCE_UID } from '../mocks/server/constants';
import { setupDataSources } from '../testSetup/datasources';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

const server = setupMswServer();

const FOLDER_UID = grafanaRulerRule.grafana_alert.namespace_uid; // 'uuid020c61ef'
const ORIGINAL_GROUP = grafanaRulerRule.grafana_alert.rule_group; // 'grafana-group-1'

describe('RuleEditor - editing a grouped Grafana rule to ungrouped', () => {
  testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

  const folder = {
    title: 'Folder A',
    uid: FOLDER_UID,
    id: 1,
    type: DashboardSearchItemType.DashDB,
    accessControl: {
      [AccessControlAction.AlertingRuleUpdate]: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;

    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.DataSourcesRead,
      AccessControlAction.FoldersWrite,
      AccessControlAction.FoldersRead,
    ]);

    setupDataSources(
      mockDataSource({
        uid: MIMIR_DATASOURCE_UID,
        type: 'prometheus',
        name: 'Mimir',
        isDefault: true,
      })
    );
    setFolderResponse(mockFolder(folder));
    mockPreviewApiResponse(server, []);
  });

  // Reproduces the bug: after editing a rule from grouped to ungrouped, a stray
  // "rule group does not exist" error toast appears on the rule detail page.
  //
  // The rule is the only member of ORIGINAL_GROUP. Moving it into a synthetic ("ungrouped")
  // group deletes ORIGINAL_GROUP on the backend. The save handler then invalidates the broad
  // `RuleGroup` cache tag, which forces a refetch of the still-subscribed original-group query
  // owned by the edit page (ExistingRuleEditor -> useRuleWithLocation). That refetch is
  // issued WITHOUT `showErrorAlert: false`, so the resulting 404 surfaces a toast.
  it('does not show a "rule group does not exist" toast after moving the only rule out of its group', async () => {
    let originalGroupRefetchedAfterMove = false;
    let ruleMovedOut = false;

    // app-platform replace (useUpsertUngroupedGrafanaRule) succeeds and "moves" the rule
    // out of its original group into the synthetic ungrouped group.
    setReplaceGrafanaRuleResolver((info) => {
      ruleMovedOut = true;
      return echoBodyResolver(info);
    });

    // Once the rule has moved out, the now-empty original group is deleted, so a GET for it
    // returns the backend's 404 "rule group does not exist" error.
    setGrafanaRulerRuleGroupResolver(({ params }) => {
      if (params.folderUid === FOLDER_UID && params.groupName === ORIGINAL_GROUP && ruleMovedOut) {
        originalGroupRefetchedAfterMove = true;
        return getErrorResponse('rule group does not exist', 404);
      }
      return HttpResponse.json(grafanaRulerGroup);
    });

    const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);

    // wait for the existing rule to load into the form
    expect(await ui.inputs.name.find()).toHaveValue(grafanaRulerRule.grafana_alert.title);

    // switch from group-based to ungrouped ("Set interval") mode
    await user.click(await ui.inputs.evaluationMode.setInterval.find());

    // save the rule
    await user.click(ui.buttons.save.get());

    // the save itself succeeds
    expect(await screen.findByRole('status')).toHaveTextContent(/rule updated successfully/i);

    // wait until the broad cache invalidation has refetched (and 404'd) the deleted original group
    await waitFor(() => expect(originalGroupRefetchedAfterMove).toBe(true));

    // The 404 from that internal refetch must not be surfaced to the user as a toast.
    // The error toast renders asynchronously after the refetch resolves, so we poll for it:
    // on a buggy build it appears (this rejection fails); once fixed it never appears.
    await expect(screen.findByText(/rule group does not exist/i, undefined, { timeout: 2000 })).rejects.toThrow();
  });
});
