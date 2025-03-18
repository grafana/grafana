import { produce } from 'immer';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, screen, userEvent, within } from 'test/test-utils';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { PERMISSIONS_NOTIFICATION_POLICIES } from 'app/features/alerting/unified/components/notification-policies/permissions';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  getErrorResponse,
  makeAllAlertmanagerConfigFetchFail,
  makeAllK8sGetEndpointsFail,
} from 'app/features/alerting/unified/mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import {
  getAlertmanagerConfig,
  setAlertmanagerConfig,
  setAlertmanagerStatus,
} from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import {
  TIME_INTERVAL_NAME_FILE_PROVISIONED,
  TIME_INTERVAL_NAME_HAPPY_PATH,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import { testWithFeatureToggles } from 'app/features/alerting/unified/test/test-utils';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import {
  AlertManagerCortexConfig,
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
  MatcherOperator,
  RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import NotificationPolicies from './NotificationPoliciesPage';
import { findRoutesMatchingFilters } from './components/notification-policies/NotificationPoliciesList';
import {
  grantUserPermissions,
  mockDataSource,
  someCloudAlertManagerConfig,
  someCloudAlertManagerStatus,
} from './mocks';
import { ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

jest.mock('./useRouteGroupsMatcher');

setupMswServer();

const updateTiming = async (selectElement: HTMLElement, value: string): Promise<void> => {
  const user = userEvent.setup();
  const input = byRole('textbox').get(selectElement);
  await user.clear(input);
  await user.type(input, value);
};

const openDefaultPolicyEditModal = async () => {
  const user = userEvent.setup();
  await user.click(await ui.moreActionsDefaultPolicy.find());
  await user.click(await ui.editButton.find());
};

const openEditModal = async (
  /** (zero-based) Index of the policy in the list to open the edit modal for  */
  index: number
) => {
  const user = userEvent.setup();
  await user.click((await ui.moreActions.findAll())[index]);
  await user.click(await ui.editButton.find());
};

const renderNotificationPolicies = (alertManagerSourceName: string = GRAFANA_RULES_SOURCE_NAME) =>
  render(
    <>
      <AppNotificationList />
      <NotificationPolicies />
    </>,
    {
      historyOptions: {
        initialEntries: [
          '/alerting/routes' +
            (alertManagerSourceName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${alertManagerSourceName}` : ''),
        ],
      },
    }
  );

const dataSources = {
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
  promAlertManager: mockDataSource<AlertManagerDataSourceJsonData>({
    name: 'PromManager',
    type: DataSourceType.Alertmanager,
    uid: 'prometheusAlertManager',
    jsonData: {
      implementation: AlertManagerImplementation.prometheus,
    },
  }),
  mimir: mockDataSource<AlertManagerDataSourceJsonData>({
    name: 'MimirAlertmanager',
    type: DataSourceType.Alertmanager,
    uid: MIMIR_DATASOURCE_UID,
    jsonData: {
      implementation: AlertManagerImplementation.mimir,
    },
  }),
};

const ui = {
  /** Row of policy tree containing default policy */
  rootRouteContainer: byTestId('am-root-route-container'),
  /** (deeply) Nested rows of policies under the default/root policy */
  row: byTestId('am-route-container'),

  newChildPolicyButton: byRole('button', { name: /New child policy/ }),
  newSiblingPolicyButton: byRole('button', { name: /Add new policy/ }),

  moreActionsDefaultPolicy: byLabelText(/more actions for default policy/i),
  moreActions: byLabelText(/more actions for policy/i),
  editButton: byRole('menuitem', { name: 'Edit' }),

  saveButton: byRole('button', { name: /update (default )?policy/i }),
  deleteRouteButton: byRole('menuitem', { name: 'Delete' }),

  receiverSelect: byTestId('am-receiver-select'),
  groupSelect: byTestId('am-group-select'),
  muteTimingSelect: byTestId('am-mute-timing-select'),

  groupWaitContainer: byTestId('am-group-wait'),
  groupIntervalContainer: byTestId('am-group-interval'),
  groupRepeatContainer: byTestId('am-repeat-interval'),

  confirmDeleteModal: byRole('dialog'),
  confirmDeleteButton: byRole('button', { name: /yes, delete policy/i }),
};

const getRootRoute = async () => {
  return ui.rootRouteContainer.find();
};

describe.each([
  // k8s API enabled
  true,
  // k8s API disabled
  false,
])('NotificationPolicies with alertingApiServer=%p', (apiServerEnabled) => {
  apiServerEnabled ? testWithFeatureToggles(['alertingApiServer']) : testWithFeatureToggles([]);
  beforeEach(() => {
    setupDataSources(...Object.values(dataSources));
    grantUserPermissions([
      AccessControlAction.AlertingInstanceRead,
      AccessControlAction.AlertingInstanceCreate,
      AccessControlAction.AlertingInstanceUpdate,
      AccessControlAction.AlertingInstancesExternalRead,
      AccessControlAction.AlertingInstancesExternalWrite,
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
      ...PERMISSIONS_NOTIFICATION_POLICIES,
    ]);
  });

  it('loads and shows routes', async () => {
    const { alertmanager_config: testConfig } = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

    const { route: defaultRoute } = testConfig;

    renderNotificationPolicies();
    const rootRouteEl = await getRootRoute();

    expect(rootRouteEl).toHaveTextContent(new RegExp(`delivered to ${defaultRoute?.receiver}`, 'i'));
    expect(rootRouteEl).toHaveTextContent(new RegExp(`grouped by ${defaultRoute?.group_by?.join(', ')}`, 'i'));
    expect(rootRouteEl).toHaveTextContent(/wait 30s to group/i);
    expect(rootRouteEl).toHaveTextContent(/wait 5m before sending/i);
    expect(rootRouteEl).toHaveTextContent(/repeated every 4h/i);

    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(5);

    defaultRoute?.routes?.forEach((route) => {
      Object.entries(route.match ?? {}).forEach(([label, value]) => {
        expect(screen.getByText(`${label} = ${value}`)).toBeInTheDocument();
      });

      Object.entries(route.match_re ?? {}).forEach(([label, value]) => {
        expect(screen.getByText(`${label} =~ ${value}`)).toBeInTheDocument();
      });

      if (route.group_by) {
        expect(rows.some((row) => row?.textContent?.includes(`Grouped by ${route.group_by?.join(', ')}`))).toBe(true);
      }

      if (route.receiver) {
        expect(rows.some((row) => row?.textContent?.includes(`Delivered to ${route.receiver}`))).toBe(true);
      }
    });
  });

  it('can edit root route if one is already defined', async () => {
    const { user } = renderNotificationPolicies();
    let rootRoute = await getRootRoute();

    expect(rootRoute).toHaveTextContent('default policy');
    expect(rootRoute).toHaveTextContent(/delivered to grafana-default-email/i);
    expect(rootRoute).toHaveTextContent(/grouped by alertname/i);

    await openDefaultPolicyEditModal();

    // configure receiver & group by
    const receiverSelect = await ui.receiverSelect.find();

    // The contact points are fetched from the k8s API, which we aren't overriding here
    // when we use a different
    await clickSelectOption(receiverSelect, 'lotsa-emails');

    const groupSelect = ui.groupSelect.get();
    await user.type(byRole('combobox').get(groupSelect), 'namespace{enter}');

    // configure timing intervals
    await user.click(screen.getByText(/timing options/i));

    await updateTiming(ui.groupWaitContainer.get(), '1m');
    await updateTiming(ui.groupIntervalContainer.get(), '4m');
    await updateTiming(ui.groupRepeatContainer.get(), '5h');

    //save
    await user.click(await screen.findByRole('button', { name: /update default policy/i }));

    // wait for it to go out of edit mode
    expect(await screen.findByText(/updated notification policies/i)).toBeInTheDocument();

    // check that new config values are rendered
    rootRoute = await getRootRoute();
    expect(rootRoute).toHaveTextContent(/delivered to lotsa-emails/i);
    expect(rootRoute).toHaveTextContent(/grouped by alertname, namespace/i);
  });

  it('can edit root route if one is not defined yet', async () => {
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, {
      alertmanager_config: {
        route: {},
        receivers: [{ name: 'lotsa-emails' }],
      },
      template_files: {},
    });
    const { user } = renderNotificationPolicies();

    await openDefaultPolicyEditModal();

    // configure receiver & group by
    const receiverSelect = await ui.receiverSelect.find();
    await clickSelectOption(receiverSelect, 'lotsa-emails');

    const groupSelect = ui.groupSelect.get();
    await user.type(byRole('combobox').get(groupSelect), 'severity{enter}');
    await user.type(byRole('combobox').get(groupSelect), 'namespace{enter}');
    //save
    await user.click(await screen.findByRole('button', { name: /update default policy/i }));

    expect(await screen.findByText(/updated notification policies/i)).toBeInTheDocument();

    const rootRoute = await getRootRoute();
    expect(rootRoute).toHaveTextContent(/delivered to lotsa-emails/i);
    expect(rootRoute).toHaveTextContent(/grouped by severity, namespace/i);
  });

  it('hides create and edit button if user does not have permission', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingInstanceRead,
      AccessControlAction.AlertingInstancesExternalRead,
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsExternalRead,
    ]);

    const { user } = renderNotificationPolicies();

    expect(ui.newChildPolicyButton.query()).not.toBeInTheDocument();
    expect(ui.newSiblingPolicyButton.query()).not.toBeInTheDocument();

    await user.click(await ui.moreActionsDefaultPolicy.find());
    expect(ui.editButton.query()).not.toBeInTheDocument();
  });

  it('Show error message if loading Alertmanager config fails', async () => {
    const errMessage = "Alertmanager has exploded. it's gone. Forget about it.";
    makeAllAlertmanagerConfigFetchFail(getErrorResponse(errMessage));
    makeAllK8sGetEndpointsFail('alerting.config.notfound', errMessage);

    renderNotificationPolicies();
    const alert = await screen.findByRole('alert', { name: /error loading alertmanager config/i });
    expect(await within(alert).findByText(errMessage)).toBeInTheDocument();
    expect(ui.rootRouteContainer.query()).not.toBeInTheDocument();
  });

  it('allows user to reload and update policies if its been changed by another user', async () => {
    jest.retryTimes(2);
    const { user } = renderNotificationPolicies();

    await getRootRoute();

    const existingConfig = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    const modifiedConfig = produce(existingConfig, (draft) => {
      draft.alertmanager_config.route!.group_interval = '12h';
    });
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, modifiedConfig);

    await openDefaultPolicyEditModal();
    await user.click(await screen.findByRole('button', { name: /update default policy/i }));

    expect(
      (await screen.findAllByText(/the notification policy tree has been updated by another user/i))[0]
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(screen.getByRole('button', { name: /reload policies/i }));

    await openDefaultPolicyEditModal();
    await user.click(await screen.findByRole('button', { name: /update default policy/i }));
    expect(await screen.findByText(/updated notification policies/i)).toBeInTheDocument();
    // TODO: Check if test flakiness/length can be improved
  }, 60000);

  it('Should be able to delete an empty route', async () => {
    const defaultConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        route: {
          routes: [{}],
        },
      },
      template_files: {},
    };

    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, defaultConfig);

    const { user } = renderNotificationPolicies(GRAFANA_RULES_SOURCE_NAME);

    await user.click(await ui.moreActions.find());
    const deleteButtons = await ui.deleteRouteButton.find();

    await user.click(deleteButtons);

    const confirmDeleteButton = ui.confirmDeleteButton.get(ui.confirmDeleteModal.get());
    expect(confirmDeleteButton).toBeInTheDocument();

    await user.click(confirmDeleteButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/updated notification policies/i);

    expect(ui.row.query()).not.toBeInTheDocument();
  });

  it('Can add a mute timing to a route', async () => {
    const { user } = renderNotificationPolicies();

    await openEditModal(0);

    const muteTimingSelect = ui.muteTimingSelect.get();
    await clickSelectOption(muteTimingSelect, TIME_INTERVAL_NAME_HAPPY_PATH);
    await clickSelectOption(muteTimingSelect, TIME_INTERVAL_NAME_FILE_PROVISIONED);

    await user.click(ui.saveButton.get());

    expect(await screen.findByRole('status')).toHaveTextContent(/updated notification policies/i);

    const policy = (await ui.row.findAll())[0];
    expect(policy).toHaveTextContent(
      `Muted when ${TIME_INTERVAL_NAME_HAPPY_PATH}, ${TIME_INTERVAL_NAME_FILE_PROVISIONED}`
    );
  });
});

describe('Grafana alertmanager - config API', () => {
  it('Converts matchers to object_matchers for grafana alertmanager', async () => {
    const { user } = renderNotificationPolicies();

    const policyIndex = 0;
    await openEditModal(policyIndex);

    // Save policy to test that format is converted to object_matchers
    await user.click(await ui.saveButton.find());

    expect(await screen.findByRole('status')).toHaveTextContent(/updated notification policies/i);

    const updatedConfig = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    expect(updatedConfig.alertmanager_config.route?.routes?.[policyIndex].object_matchers).toMatchSnapshot();
  });
});
describe('Non-Grafana alertmanagers', () => {
  it.skip('Shows an empty config when config returns an error and the AM supports lazy config initialization', async () => {
    makeAllAlertmanagerConfigFetchFail(getErrorResponse('alertmanager storage object not found'));
    setAlertmanagerStatus(dataSources.mimir.uid, someCloudAlertManagerStatus);
    renderNotificationPolicies(dataSources.mimir.name);

    expect(await ui.rootRouteContainer.find()).toBeInTheDocument();
  });

  it('Keeps matchers for non-grafana alertmanager sources', async () => {
    setAlertmanagerConfig(dataSources.am.uid, {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          continue: false,
          receiver: 'default',
          group_by: ['alertname'],
          routes: [
            {
              receiver: 'simple-receiver',
              matchers: ['hello=world', 'foo!=bar'],
            },
          ],
          group_interval: '4m',
          group_wait: '1m',
          repeat_interval: '5h',
        },
        templates: [],
      },
      template_files: {},
    });

    const { user } = renderNotificationPolicies(dataSources.am.name);

    const policyIndex = 0;
    await openEditModal(policyIndex);

    // Save policy to test that format is NOT converted
    await user.click(await ui.saveButton.find());

    const updatedConfig = getAlertmanagerConfig(dataSources.am.uid);
    expect(updatedConfig.alertmanager_config.route?.routes?.[policyIndex].matchers).toMatchSnapshot();
  });

  it('Prometheus Alertmanager routes cannot be edited', async () => {
    setAlertmanagerStatus(dataSources.promAlertManager.uid, {
      ...someCloudAlertManagerStatus,
      config: someCloudAlertManagerConfig.alertmanager_config,
    });
    renderNotificationPolicies(dataSources.promAlertManager.name);

    expect(await ui.rootRouteContainer.find()).toBeInTheDocument();

    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(2);

    expect(ui.moreActions.query()).not.toBeInTheDocument();
    expect(ui.moreActionsDefaultPolicy.query()).not.toBeInTheDocument();
  });

  it('Prometheus Alertmanager has no CTA button if there are no specific policies', async () => {
    setAlertmanagerStatus(dataSources.promAlertManager.uid, {
      ...someCloudAlertManagerStatus,
      config: {
        ...someCloudAlertManagerConfig.alertmanager_config,
        route: {
          ...someCloudAlertManagerConfig.alertmanager_config.route,
          routes: undefined,
        },
      },
    });

    renderNotificationPolicies(dataSources.promAlertManager.name);

    expect(await ui.rootRouteContainer.find()).toBeInTheDocument();

    expect(ui.newChildPolicyButton.query()).not.toBeInTheDocument();
    expect(ui.newSiblingPolicyButton.query()).not.toBeInTheDocument();
  });
});

describe('findRoutesMatchingFilters', () => {
  const simpleRouteTree: RouteWithID = {
    id: '0',
    receiver: 'default-receiver',
    routes: [
      {
        id: '1',
        receiver: 'simple-receiver',
        matchers: ['hello=world', 'foo!=bar'],
        routes: [
          {
            id: '2',
            matchers: ['bar=baz'],
          },
        ],
      },
    ],
  };

  it('should not filter when we do not have any valid filters', () => {
    expect(findRoutesMatchingFilters(simpleRouteTree, {})).toHaveProperty('filtersApplied', false);
  });

  it('should not match non-existing', () => {
    expect(
      findRoutesMatchingFilters(simpleRouteTree, {
        labelMatchersFilter: [['foo', MatcherOperator.equal, 'bar']],
      }).matchedRoutesWithPath.size
    ).toBe(0);

    const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
      contactPointFilter: 'does-not-exist',
    });

    expect(matchingRoutes).toMatchSnapshot();
  });

  it('should work with only label matchers', () => {
    const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
      labelMatchersFilter: [['hello', MatcherOperator.equal, 'world']],
    });

    expect(matchingRoutes).toMatchSnapshot();
  });

  it('should work with only contact point and inheritance', () => {
    const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
      contactPointFilter: 'simple-receiver',
    });

    expect(matchingRoutes).toMatchSnapshot();
  });

  it('should work with non-intersecting filters', () => {
    const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
      labelMatchersFilter: [['hello', MatcherOperator.equal, 'world']],
      contactPointFilter: 'does-not-exist',
    });

    expect(matchingRoutes).toMatchSnapshot();
  });

  it('should work with all filters', () => {
    const matchingRoutes = findRoutesMatchingFilters(simpleRouteTree, {
      labelMatchersFilter: [['hello', MatcherOperator.equal, 'world']],
      contactPointFilter: 'simple-receiver',
    });

    expect(matchingRoutes).toMatchSnapshot();
  });
});
