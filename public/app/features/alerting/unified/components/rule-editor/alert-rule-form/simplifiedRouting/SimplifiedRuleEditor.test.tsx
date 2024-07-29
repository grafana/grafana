import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Route } from 'react-router-dom';
import { TestProvider } from 'test/helpers/TestProvider';
import { ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole } from 'testing-library-selector';

import { config, locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import RuleEditor from 'app/features/alerting/unified/RuleEditor';
import * as ruler from 'app/features/alerting/unified/api/ruler';
import * as useContactPoints from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setAlertmanagerChoices } from 'app/features/alerting/unified/mocks/server/configure';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import * as utils_config from 'app/features/alerting/unified/utils/config';
import {
  DataSourceType,
  GRAFANA_DATASOURCE_NAME,
  GRAFANA_RULES_SOURCE_NAME,
  useGetAlertManagerDataSourcesByPermissionAndConfig,
} from 'app/features/alerting/unified/utils/datasource';
import { getDefaultQueries } from 'app/features/alerting/unified/utils/rule-form';
import { searchFolders } from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { grafanaRulerEmptyGroup, grafanaRulerNamespace2, grafanaRulerRule } from '../../../../mocks/grafanaRulerApi';
import { setupDataSources } from '../../../../testSetup/datasources';
import { RECEIVER_META_KEY } from '../../../contact-points/useContactPoints';
import { ContactPointWithMetadata } from '../../../contact-points/utils';
import { ExpressionEditorProps } from '../../ExpressionEditor';

jest.mock('app/features/alerting/unified/components/rule-editor/ExpressionEditor', () => ({
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('app/features/manage-dashboards/state/actions');

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  QueryEditorRow: () => <p>hi</p>,
}));

const user = userEvent.setup();

// jest.spyOn(utils_config, 'getAllDataSources');
// jest.spyOn(dsByPermission, 'useAlertManagersByPermission');
jest.spyOn(useContactPoints, 'useContactPointsWithStatus');

jest.setTimeout(60 * 1000);

const mocks = {
  getAllDataSources: jest.mocked(utils_config.getAllDataSources),
  searchFolders: jest.mocked(searchFolders),
  useContactPointsWithStatus: jest.mocked(useContactPoints.useContactPointsWithStatus),
  useGetAlertManagerDataSourcesByPermissionAndConfig: jest.mocked(useGetAlertManagerDataSourcesByPermissionAndConfig),
  api: {
    setRulerRuleGroup: jest.spyOn(ruler, 'setRulerRuleGroup'),
  },
};

setupMswServer();

describe('Can create a new grafana managed alert unsing simplified routing', () => {
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

  it('cannot create new grafana managed alert when using simplified routing and not selecting a contact point', async () => {
    // no contact points found
    mocks.useContactPointsWithStatus.mockReturnValue({
      contactPoints: [],
      isLoading: false,
      error: undefined,
      refetchReceivers: jest.fn(),
    });

    mocks.api.setRulerRuleGroup.mockResolvedValue();
    mocks.searchFolders.mockResolvedValue([
      {
        title: 'Folder A',
        uid: grafanaRulerRule.grafana_alert.namespace_uid,
        id: 1,
        type: DashboardSearchItemType.DashDB,
      },
      {
        title: 'Folder B',
        id: 2,
      },
      {
        title: 'Folder / with slash',
        id: 2,
        uid: 'b',
        type: DashboardSearchItemType.DashDB,
      },
    ] as DashboardSearchHit[]);

    config.featureToggles.alertingSimplifiedRouting = true;
    renderSimplifiedRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    const folderInput = await ui.inputs.folder.find();
    await clickSelectOption(folderInput, 'Folder A');
    const groupInput = await ui.inputs.group.find();
    await user.click(byRole('combobox').get(groupInput));
    await clickSelectOption(groupInput, grafanaRulerRule.grafana_alert.rule_group);
    //select contact point routing
    await user.click(ui.inputs.simplifiedRouting.contactPointRouting.get());
    // do not select a contact point
    // save and check that call to backend was not made
    await user.click(ui.buttons.saveAndExit.get());
    await waitFor(() => {
      expect(screen.getByText('Contact point is required.')).toBeInTheDocument();
      expect(mocks.api.setRulerRuleGroup).not.toHaveBeenCalled();
    });
  });
  it('simplified routing is not available when Grafana AM is not enabled', async () => {
    config.featureToggles.alertingSimplifiedRouting = true;
    setAlertmanagerChoices(AlertmanagerChoice.External, 1);
    renderSimplifiedRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    expect(ui.inputs.simplifiedRouting.contactPointRouting.query()).not.toBeInTheDocument();
  });

  it('can create new grafana managed alert when using simplified routing and selecting a contact point', async () => {
    const contactPointsAvailable: ContactPointWithMetadata[] = [
      {
        name: 'contact_point1',
        grafana_managed_receiver_configs: [
          {
            name: 'contact_point1',
            type: 'email',
            disableResolveMessage: false,
            [RECEIVER_META_KEY]: {
              name: 'contact_point1',
              description: 'contact_point1 description',
            },
            settings: {},
          },
        ],
        policies: [],
      },
    ];
    mocks.useContactPointsWithStatus.mockReturnValue({
      contactPoints: contactPointsAvailable,
      isLoading: false,
      error: undefined,
      refetchReceivers: jest.fn(),
    });

    mocks.api.setRulerRuleGroup.mockResolvedValue();
    mocks.searchFolders.mockResolvedValue([
      {
        title: 'Folder A',
        uid: grafanaRulerNamespace2.uid,
        id: 1,
        type: DashboardSearchItemType.DashDB,
      },
      {
        title: 'Folder B',
        id: 2,
        uid: 'b',
        type: DashboardSearchItemType.DashDB,
      },
      {
        title: 'Folder / with slash',
        uid: 'c',
        id: 2,
        type: DashboardSearchItemType.DashDB,
      },
    ] as DashboardSearchHit[]);

    config.featureToggles.alertingSimplifiedRouting = true;
    renderSimplifiedRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    const folderInput = await ui.inputs.folder.find();
    await clickSelectOption(folderInput, 'Folder A');
    const groupInput = await ui.inputs.group.find();
    await user.click(byRole('combobox').get(groupInput));
    await clickSelectOption(groupInput, grafanaRulerEmptyGroup.name);
    //select contact point routing
    await user.click(ui.inputs.simplifiedRouting.contactPointRouting.get());
    const contactPointInput = await ui.inputs.simplifiedRouting.contactPoint.find();
    await user.click(byRole('combobox').get(contactPointInput));
    await clickSelectOption(contactPointInput, 'contact_point1');

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
                receiver: 'contact_point1',
                repeat_interval: undefined,
              },
            },
          },
        ],
      }
    );
  });
});

function renderSimplifiedRuleEditor() {
  locationService.push(`/alerting/new/alerting`);

  return render(
    <TestProvider>
      <AlertmanagerProvider alertmanagerSourceName={GRAFANA_DATASOURCE_NAME} accessType="notification">
        <Route path={['/alerting/new/:type', '/alerting/:id/edit']} component={RuleEditor} />
      </AlertmanagerProvider>
    </TestProvider>
  );
}
