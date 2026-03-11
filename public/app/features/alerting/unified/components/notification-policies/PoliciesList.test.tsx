import userEvent from '@testing-library/user-event';
import { render, screen, within } from 'test/test-utils';
import { byTestId } from 'testing-library-selector';

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
import { K8sAnnotations } from '../../utils/k8s/constants';

import { countPolicies } from './PoliciesList';

jest.mock('../../useRouteGroupsMatcher');

jest.mock('../../hooks/useAbilities', () => ({
  ...jest.requireActual('../../hooks/useAbilities'),
  useAlertmanagerAbilities: jest.fn(),
  useAlertmanagerAbility: jest.fn(),
}));

const mocks = {
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
  rootRouteContainer: byTestId('am-root-route-container'),
  createPolicyButton: byTestId('create-policy-button'),
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
    const included = allowed.includes(action);
    return [true, included];
  });

  mocks.useAlertmanagerAbilities.mockImplementation((actions) => {
    return actions.map((action) => {
      const included = allowed.includes(action);
      return [true, included];
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

    // MultiCombobox uses canvas measureText which isn't available in jsdom.
    // Must be re-applied after jest.resetAllMocks() clears mock return values.
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      measureText: jest.fn().mockReturnValue({ width: 0 }),
      font: '',
    }) as never;

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

        // Wait for all root route containers to render
        const allRoots = await ui.rootRouteContainer.findAll();
        expect(allRoots.length).toBeGreaterThanOrEqual(1);

        // Find the matching root by receiver name.
        // For duplicate receivers, also match by provenance text.
        const receiverName = route.spec.defaults.receiver!;
        const isProvisioned = route.metadata.annotations?.[K8sAnnotations.Provenance] !== KnownProvenance.None;
        const routeEl = allRoots.find((el) => {
          const text = el.textContent ?? '';
          const hasReceiver = text.includes(receiverName);
          if (!hasReceiver) {
            return false;
          }
          // If provisioned, ensure the element also has "Provisioned" text
          if (isProvisioned) {
            return text.includes('Provisioned');
          }
          // If not provisioned and receiver matches but there could be a duplicate,
          // ensure the element does NOT have "Provisioned" text
          return !text.includes('Provisioned');
        })!;
        expect(routeEl).toBeDefined();

        // Check receiver is displayed
        expect(routeEl).toHaveTextContent(new RegExp(`Delivered to`, 'i'));
        expect(routeEl).toHaveTextContent(new RegExp(receiverName, 'i'));

        // Check grouping — only shown when group_by is explicitly set as an array
        const groupBy = route?.spec.defaults.group_by;
        if (Array.isArray(groupBy) && groupBy.length > 0) {
          if (groupBy[0] === '...') {
            expect(routeEl).toHaveTextContent(/Not grouping/i);
          } else {
            expect(routeEl).toHaveTextContent(new RegExp(`Grouped by ${groupBy.join(', ')}`, 'i'));
          }
        } else if (Array.isArray(groupBy) && groupBy.length === 0) {
          expect(routeEl).toHaveTextContent(/Single group/i);
        }

        // Check provisioned badge
        if (isProvisioned) {
          expect(routeEl).toHaveTextContent(/Provisioned/i);
        }

        // Check subpolicies exist in the tree data
        const size = countPolicies(route.spec);
        expect(size).toBeGreaterThanOrEqual(0);
      }
    );
  });

  describe('Table action permissions', () => {
    describe('Create', () => {
      it('enable if user has permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.CreateNotificationPolicy,
          AlertmanagerAction.ViewNotificationPolicyTree,
        ]);
        renderNotificationPolicies();
        expect(await ui.createPolicyButton.find()).toBeInTheDocument();
        expect(ui.createPolicyButton.query()).toBeEnabled();
      });
      it('disable if user does not have permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        renderNotificationPolicies();
        expect(await ui.createPolicyButton.find()).toBeInTheDocument();
        expect(ui.createPolicyButton.query()).toBeDisabled();
      });
    });
  });

  describe('Policy action permissions', () => {
    describe('Edit', () => {
      it('shows edit menu item if user has edit permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.UpdateNotificationPolicyTree,
        ]);

        const user = userEvent.setup();
        renderNotificationPolicies();
        const allRoots = await ui.rootRouteContainer.findAll();
        const defaultPolicyEl = allRoots[0];
        await user.click(within(defaultPolicyEl).getByTestId('more-actions'));
        expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
      });
      it('does not show more actions if user has no edit permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        renderNotificationPolicies();
        const allRoots = await ui.rootRouteContainer.findAll();
        const defaultPolicyEl = allRoots[0];
        // No actions available = no more-actions button rendered
        expect(within(defaultPolicyEl).queryByTestId('more-actions')).not.toBeInTheDocument();
      });
      it('shows edit as disabled if policy is provisioned', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.UpdateNotificationPolicyTree,
        ]);

        const user = userEvent.setup();
        renderNotificationPolicies();
        const allRoots = await ui.rootRouteContainer.findAll();
        // Find the provisioned policy (has "Provisioned" text)
        const provisionedPolicy = allRoots.find((el) => el.textContent?.includes('Provisioned'));
        expect(provisionedPolicy).toBeDefined();
        await user.click(within(provisionedPolicy!).getByTestId('more-actions'));
        const editItem = screen.getByRole('menuitem', { name: 'Edit' });
        expect(editItem).toBeInTheDocument();
        expect(editItem).toBeDisabled();
      });
    });
    describe('Export', () => {
      it('enable if user has permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.ExportNotificationPolicies,
        ]);

        const user = userEvent.setup();
        renderNotificationPolicies();
        const allRoots = await ui.rootRouteContainer.findAll();
        const defaultPolicyEl = allRoots[0];
        await user.click(within(defaultPolicyEl).getByTestId('more-actions'));
        expect(screen.getByRole('menuitem', { name: 'Export' })).toBeInTheDocument();
      });
      it('does not show more actions if user has no export or edit permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        renderNotificationPolicies();
        const allRoots = await ui.rootRouteContainer.findAll();
        const defaultPolicyEl = allRoots[0];
        // No actions available = no more-actions button rendered
        expect(within(defaultPolicyEl).queryByTestId('more-actions')).not.toBeInTheDocument();
      });
    });

    describe('Reset', () => {
      it('enable on default policy if user has permission', async () => {
        grantAlertmanagerAbilities([
          AlertmanagerAction.ViewNotificationPolicyTree,
          AlertmanagerAction.DeleteNotificationPolicy,
        ]);

        const user = userEvent.setup();
        renderNotificationPolicies();
        const allRoots = await ui.rootRouteContainer.findAll();
        const defaultPolicyEl = allRoots[0];
        await user.click(within(defaultPolicyEl).getByTestId('more-actions'));
        const resetItem = screen.getByRole('menuitem', { name: 'Reset' });
        expect(resetItem).toBeInTheDocument();
      });
      it('does not show more actions on default policy if user has no permission', async () => {
        grantAlertmanagerAbilities([AlertmanagerAction.ViewNotificationPolicyTree]);

        renderNotificationPolicies();
        const allRoots = await ui.rootRouteContainer.findAll();
        const defaultPolicyEl = allRoots[0];
        // No actions available = no more-actions button rendered
        expect(within(defaultPolicyEl).queryByTestId('more-actions')).not.toBeInTheDocument();
      });
    });
  });
});
