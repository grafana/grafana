import { ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, screen, waitFor, waitForElementToBeRemoved, userEvent } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import RuleEditor from 'app/features/alerting/unified/RuleEditor';
import * as ruler from 'app/features/alerting/unified/api/ruler';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setAlertmanagerChoices } from 'app/features/alerting/unified/mocks/server/configure';
import { FOLDER_TITLE_HAPPY_PATH } from 'app/features/alerting/unified/mocks/server/handlers/search';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import {
  DataSourceType,
  GRAFANA_DATASOURCE_NAME,
  GRAFANA_RULES_SOURCE_NAME,
} from 'app/features/alerting/unified/utils/datasource';
import { getDefaultQueries } from 'app/features/alerting/unified/utils/rule-form';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { grafanaRulerEmptyGroup, grafanaRulerNamespace2 } from '../../../../mocks/grafanaRulerApi';
import { setupDataSources } from '../../../../testSetup/datasources';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

const mocks = {
  api: {
    setRulerRuleGroup: jest.spyOn(ruler, 'setRulerRuleGroup'),
  },
};

setupMswServer();

const dataSources = {
  default: mockDataSource(
    {
      type: 'prometheus',
      name: 'Prom',
      isDefault: true,
    },
    { alerting: false }
  ),
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};
setupDataSources(dataSources.default, dataSources.am);

const selectFolderAndGroup = async () => {
  const user = userEvent.setup();
  const folderInput = await ui.inputs.folder.find();
  await clickSelectOption(folderInput, FOLDER_TITLE_HAPPY_PATH);
  const groupInput = await ui.inputs.group.find();
  await user.click(await byRole('combobox').find(groupInput));
  await clickSelectOption(groupInput, grafanaRulerEmptyGroup.name);
};

describe('Can create a new grafana managed alert using simplified routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
    config.featureToggles.alertingSimplifiedRouting = true;
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.DataSourcesRead,
      AccessControlAction.DataSourcesWrite,
      AccessControlAction.DataSourcesCreate,
      AccessControlAction.FoldersWrite,
      AccessControlAction.FoldersRead,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  it('cannot create new grafana managed alert when using simplified routing and not selecting a contact point', async () => {
    const user = userEvent.setup();

    renderSimplifiedRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    await selectFolderAndGroup();

    //select contact point routing
    await user.click(ui.inputs.simplifiedRouting.contactPointRouting.get());

    // do not select a contact point
    // save and check that call to backend was not made
    await user.click(ui.buttons.saveAndExit.get());
    expect(await screen.findByText('Contact point is required.')).toBeInTheDocument();
    expect(mocks.api.setRulerRuleGroup).not.toHaveBeenCalled();
  });

  it('simplified routing is not available when Grafana AM is not enabled', async () => {
    setAlertmanagerChoices(AlertmanagerChoice.External, 1);
    renderSimplifiedRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    expect(ui.inputs.simplifiedRouting.contactPointRouting.query()).not.toBeInTheDocument();
  });

  it('can create new grafana managed alert when using simplified routing and selecting a contact point', async () => {
    const user = userEvent.setup();
    const contactPointName = 'lotsa-emails';

    renderSimplifiedRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    await selectFolderAndGroup();

    //select contact point routing
    await user.click(ui.inputs.simplifiedRouting.contactPointRouting.get());
    const contactPointInput = await ui.inputs.simplifiedRouting.contactPoint.find();
    await user.click(byRole('combobox').get(contactPointInput));
    await clickSelectOption(contactPointInput, contactPointName);

    // save and check what was sent to backend
    await user.click(ui.buttons.saveAndExit.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(
      { dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' },
      grafanaRulerNamespace2.uid,
      {
        interval: grafanaRulerEmptyGroup.interval,
        name: grafanaRulerEmptyGroup.name,
        rules: [
          {
            annotations: {},
            labels: {},
            for: '1m',
            grafana_alert: {
              condition: 'B',
              data: getDefaultQueries(),
              exec_err_state: GrafanaAlertStateDecision.Error,
              is_paused: false,
              no_data_state: 'NoData',
              title: 'my great new rule',
              notification_settings: {
                group_by: undefined,
                group_interval: undefined,
                group_wait: undefined,
                mute_timings: undefined,
                receiver: contactPointName,
                repeat_interval: undefined,
              },
            },
          },
        ],
      }
    );
  });

  describe('alertingApiServer enabled', () => {
    beforeEach(() => {
      config.featureToggles.alertingApiServer = true;
    });

    it('allows selecting a contact point when using alerting API server', async () => {
      const user = userEvent.setup();
      renderSimplifiedRuleEditor();
      await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

      await user.click(await ui.inputs.simplifiedRouting.contactPointRouting.find());

      const contactPointInput = await ui.inputs.simplifiedRouting.contactPoint.find();
      await user.click(byRole('combobox').get(contactPointInput));
      await clickSelectOption(contactPointInput, 'lotsa-emails');

      expect(await screen.findByText('Email')).toBeInTheDocument();
    });
  });
});

function renderSimplifiedRuleEditor() {
  return render(
    <AlertmanagerProvider alertmanagerSourceName={GRAFANA_DATASOURCE_NAME} accessType="notification">
      <Route path={['/alerting/new/:type', '/alerting/:id/edit']} component={RuleEditor} />
    </AlertmanagerProvider>,
    { historyOptions: { initialEntries: ['/alerting/new/alerting'] } }
  );
}
