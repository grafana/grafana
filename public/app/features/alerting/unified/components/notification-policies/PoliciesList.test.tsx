import { render } from 'test/test-utils';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';

import { config } from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { AccessControlAction } from '../../../../../types/accessControl';
import NotificationPolicies from '../../NotificationPoliciesPage';
import { AlertmanagerAction, useAlertmanagerAbilities, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { getRoutingTree, getRoutingTreeList, resetRoutingTreeMap } from '../../mocks/server/entities/k8s/routingtrees';
import { KnownProvenance } from '../../types/knownProvenance';
import { DataSourceType } from '../../utils/datasource';
import { K8sAnnotations, ROOT_ROUTE_NAME } from '../../utils/k8s/constants';

import { countPolicies } from './PoliciesList';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';

jest.mock('../../useRouteGroupsMatcher');

jest.mock('../../hooks/useAbilities', () => ({
  ...jest.requireActual('../../hooks/useAbilities'),
  useAlertmanagerAbilities: jest.fn(),
  useAlertmanagerAbility: jest.fn(),
}));

const mocks = {
  // Mock the hooks that are actually used by the components:
  useAlertmanagerAbilities: jest.mocked(useAlertmanagerAbilities),
  useAlertmanagerAbility: jest.mocked(useAlertmanagerAbility),
};

setupMswServer();

const renderNotificationPolicies = () =>
  render(
    <>
      <AppNotificationList />
      <NotificationPolicies />
    </>,
    {
      historyOptions: {
        initialEntries: ['/alerting/routes'],
      },
    }
  );

const dataSources = {
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  /** Policy table row by name */
  routeContainer: (name: string) => byTestId(`routing-tree_${name}`),
  /** Search box for routing policies */
  policyFilter: byRole('textbox', { name: /search routing trees/ }),

  createPolicyButton: byTestId('create-policy-button'),
  exportAllButton: byTestId('export-all-policy-button'),
  viewButton: byTestId('view-action'),
  editButton: byTestId('edit-action'),
  moreActionsButton: byTestId('more-actions'),
  exportButton: byRole('menuitem', { name: /export/i }),
  deleteButton: byRole('menuitem', { name: /delete/i }),

  /** (deeply) Nested rows of policies under the default/root policy */
  row: byTestId('am-route-container'),

  newChildPolicyButton: byRole('button', { name: /New child policy/ }),
  newSiblingPolicyButton: byRole('button', { name: /Add new policy/ }),

  moreActionsDefaultPolicy: byLabelText(/more actions for default policy/i),
  moreActions: byLabelText(/more actions for policy/i),
  // editButton: byRole('menuitem', { name: 'Edit' }),

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

const getRoute = async (routeName: string) => {
  return ui.routeContainer(routeName).find();
};

const allPolicyActions = [
  AlertmanagerAction.CreateNotificationPolicy,
  AlertmanagerAction.ViewNotificationPolicyTree,
  AlertmanagerAction.UpdateNotificationPolicyTree,
  AlertmanagerAction.DeleteNotificationPolicy,
  AlertmanagerAction.ExportNotificationPolicies,
];

const grantAlertmanagerAbilities = (allowed: AlertmanagerAction[]) => {
  mocks.useAlertmanagerAbility.mockImplementation((action) => {
    // Default to all known policy actions supported and allowed, others are denied.
    const included = allowed.includes(action);
    return [true, included]; // Always supported, but only allow those from input.
  });

  mocks.useAlertmanagerAbilities.mockImplementation((actions) => {
    // Default to all known policy actions supported and allowed, others are denied.
    return actions.map((action) => {
      const included = allowed.includes(action);
      return [true, included]; // Always supported, but only allow those from input.
    });
  });
};

describe('PoliciesList', () => {
  const originalFeatureToggle = config.featureToggles.alertingMultiplePolicies;
  afterAll(() => {
    config.featureToggles.alertingMultiplePolicies = originalFeatureToggle;
  });

  beforeEach(() => {
    config.featureToggles.alertingMultiplePolicies = true;
    setupDataSources(...Object.values(dataSources));
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();

    grantAlertmanagerAbilities(allPolicyActions);

    grantUserPermissions([AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingNotificationsRead]);

    resetRoutingTreeMap();
  });

  describe('Route headers and metadata', () => {
    const allRoutes = getRoutingTreeList();
    expect(allRoutes).toHaveLength(5);
    it.each(allRoutes.map((route) => ({ routeName: route.metadata.name! })))(
      'policy: $routeName',
      async ({ routeName }) => {
        const route = getRoutingTree(routeName)!;

        renderNotificationPolicies();
        const routeEl = await getRoute(routeName);

        const size = countPolicies(route.spec);
        if (size === 0) {
          expect(routeEl).not.toHaveTextContent(new RegExp(`contains \\d+ polic(ies|y)`, 'i'));
        } else {
          expect(routeEl).toHaveTextContent(new RegExp(`contains ${size} polic(ies|y)`, 'i'));
        }

        const groupBy = route?.spec.defaults.group_by ?? [];
        let groupingText = 'Single group';
        if (groupBy.length > 0) {
          groupingText = groupBy[0] === '...' ? 'Not grouping' : `grouped by ${groupBy.join(', ')}`;
        }

        expect(routeEl).toHaveTextContent(new RegExp(`delivered to ${route?.spec.defaults.receiver}`, 'i'));
        expect(routeEl).toHaveTextContent(new RegExp(`${groupingText}`, 'i'));
        expect(routeEl).toHaveTextContent(
          new RegExp(`wait ${route?.spec.defaults.group_wait ?? TIMING_OPTIONS_DEFAULTS.group_wait} to group`, 'i')
        );
        expect(routeEl).toHaveTextContent(
          new RegExp(
            `wait ${route?.spec.defaults.group_interval ?? TIMING_OPTIONS_DEFAULTS.group_interval} before sending`,
            'i'
          )
        );
        expect(routeEl).toHaveTextContent(
          new RegExp(
            `repeated every ${route?.spec.defaults.repeat_interval ?? TIMING_OPTIONS_DEFAULTS.repeat_interval}`,
            'i'
          )
        );

        if (route?.metadata.annotations?.[K8sAnnotations.Provenance] !== KnownProvenance.None) {
          expect(routeEl).toHaveTextContent(new RegExp(`Provisioned`, 'i'));
        }
      }
    );
  });

  describe('Action permissions', () => {
    describe('Create', () => {
      it('enable if user has permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.CreateNotificationPolicy,
          AlertmanagerAction.ViewNotificationPolicyTree,
        ]);
        renderNotificationPolicies();
        await getRoute(ROOT_ROUTE_NAME);
        expect(await ui.createPolicyButton.find()).toBeInTheDocument();
        expect(ui.createPolicyButton.query()).toBeEnabled();
      });
      it('disable if user does not have permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        renderNotificationPolicies();
        await getRoute(ROOT_ROUTE_NAME);
        expect(await ui.createPolicyButton.find()).toBeInTheDocument();
        expect(ui.createPolicyButton.query()).toBeDisabled();
      });
    });
    describe('View/Edit', () => {
      it('shows view if user has no edit permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        renderNotificationPolicies();
        const defaultPolicyEl = await getRoute(ROOT_ROUTE_NAME);
        const btn = await ui.viewButton.find(defaultPolicyEl);
        expect(btn).toBeInTheDocument();
        expect(btn).toBeEnabled();
      });
      it('shows edit if user has edit permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.UpdateNotificationPolicyTree,
        ]);

        renderNotificationPolicies();
        const defaultPolicyEl = await getRoute(ROOT_ROUTE_NAME);
        const btn = await ui.editButton.find(defaultPolicyEl);
        expect(btn).toBeInTheDocument();
        expect(btn).toBeEnabled();
      });
      it('shows view if policy is provisioned', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.UpdateNotificationPolicyTree,
        ]);

        renderNotificationPolicies();
        const defaultPolicyEl = await getRoute('Managed Policy - Empty Provisioned');
        const btn = await ui.viewButton.find(defaultPolicyEl);
        expect(btn).toBeInTheDocument();
        expect(btn).toBeEnabled();
      });
    });
    describe('More > Export', () => {
      it('enable if user has permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.ExportNotificationPolicies,
        ]);

        const { user } = renderNotificationPolicies();
        const defaultPolicyEl = await getRoute(ROOT_ROUTE_NAME);

        await user.click(await ui.moreActionsButton.find(defaultPolicyEl));

        const btn = await ui.exportButton.find();
        expect(btn).toBeInTheDocument();
        expect(btn).toBeEnabled();
      });
      it('disable if user does not have permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        const { user } = renderNotificationPolicies();
        const defaultPolicyEl = await getRoute(ROOT_ROUTE_NAME);

        await user.click(await ui.moreActionsButton.find(defaultPolicyEl));

        const btn = await ui.exportButton.find();
        expect(btn).toBeInTheDocument();
        expect(btn).toBeDisabled();
      });
    });

    describe('Delete', () => {
      it('enable if user has permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.DeleteNotificationPolicy,
        ]);

        const { user } = renderNotificationPolicies();
        const defaultPolicyEl = await getRoute(ROOT_ROUTE_NAME);

        await user.click(await ui.moreActionsButton.find(defaultPolicyEl));

        const btn = await ui.deleteButton.find();
        expect(btn).toBeInTheDocument();
        expect(btn).toBeEnabled();
      });
      it('disable if user has no permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        const { user } = renderNotificationPolicies();
        const defaultPolicyEl = await getRoute(ROOT_ROUTE_NAME);

        await user.click(await ui.moreActionsButton.find(defaultPolicyEl));

        const btn = await ui.deleteButton.find();
        expect(btn).toBeInTheDocument();
        expect(btn).toBeDisabled();
      });
      it('disable if is provisioned', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.DeleteNotificationPolicy,
        ]);

        const { user } = renderNotificationPolicies();
        const defaultPolicyEl = await getRoute('Managed Policy - Empty Provisioned');

        await user.click(await ui.moreActionsButton.find(defaultPolicyEl));

        const viewButton = await ui.deleteButton.find();
        expect(viewButton).toBeInTheDocument();
        expect(viewButton).toBeDisabled();
      });
    });
  });
});
