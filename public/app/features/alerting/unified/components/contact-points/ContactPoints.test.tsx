import { MemoryHistoryBuildOptions } from 'history';
import { ComponentProps, ReactNode } from 'react';
import { render, screen, userEvent, waitFor, waitForElementToBeRemoved, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { flushMicrotasks } from 'app/features/alerting/unified/test/test-utils';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { ContactPoint } from './ContactPoint';
import { ContactPointsPageContents } from './ContactPoints';
import { RECEIVER_META_KEY } from './constants';
import setupMimirFlavoredServer from './mocks/mimirFlavoredServer';
import setupVanillaAlertmanagerFlavoredServer, {
  VANILLA_ALERTMANAGER_DATASOURCE_UID,
} from './mocks/vanillaAlertmanagerServer';
import { ContactPointWithMetadata, ReceiverConfigWithMetadata, RouteReference } from './utils';

/**
 * There are lots of ways in which we test our pages and components. Here's my opinionated approach to testing them.
 *
 *  Use MSW to mock API responses, you can copy the JSON results from the network panel and use them in a __mocks__ folder.
 *
 * 1. Make sure we have "presentation" components we can test without mocking data,
 *    test these if they have some logic in them (hiding / showing things) and sad paths.
 *
 * 2. For testing the "container" components, check if data fetching is working as intended (you can use loading state)
 *    and check if we're not in an error state (although you can test for that too for sad path).
 *
 * 3. Write tests for the hooks we call in the "container" components
 *    if those have any logic or data structure transformations in them.
 *
 * ⚠️ Always set up the MSW server only once – MWS does not support multiple calls to setupServer(); and causes all sorts of weird issues
 */
const server = setupMswServer();

export const renderWithProvider = (
  children: ReactNode,
  historyOptions?: MemoryHistoryBuildOptions,
  providerProps?: Partial<ComponentProps<typeof AlertmanagerProvider>>
) =>
  render(
    <AlertmanagerProvider accessType="notification" {...providerProps}>
      {children}
    </AlertmanagerProvider>,
    { historyOptions }
  );

const basicContactPoint: ContactPointWithMetadata = {
  name: 'my-contact-point',
  id: 'foo',
  grafana_managed_receiver_configs: [],
};

const basicContactPointInUse: ContactPointWithMetadata = {
  ...basicContactPoint,
  metadata: {
    annotations: {
      [K8sAnnotations.InUseRules]: '1',
      [K8sAnnotations.InUseRoutes]: '1',
    },
  },
};

const contactPointWithEverything: ContactPointWithMetadata = {
  ...basicContactPoint,
  metadata: {
    annotations: {
      [K8sAnnotations.InUseRules]: '3',
      [K8sAnnotations.InUseRoutes]: '1',
      [K8sAnnotations.AccessAdmin]: 'true',
      [K8sAnnotations.AccessDelete]: 'true',
      [K8sAnnotations.AccessWrite]: 'true',
    },
  },
};

const clickMoreActionsButton = async (name: string) => {
  const user = userEvent.setup();
  const moreActions = await screen.findByRole('button', { name: `More actions for contact point "${name}"` });
  await user.click(moreActions);
  await flushMicrotasks();
};

const attemptDeleteContactPoint = async (name: string) => {
  const user = userEvent.setup();

  await clickMoreActionsButton(name);

  const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
  await user.click(deleteButton);

  await screen.findByRole('heading', { name: /delete contact point/i });
  return user.click(await screen.findByRole('button', { name: /delete contact point/i }));
};

const alertManager = mockDataSource<AlertManagerDataSourceJsonData>({
  name: VANILLA_ALERTMANAGER_DATASOURCE_UID,
  uid: VANILLA_ALERTMANAGER_DATASOURCE_UID,
  type: DataSourceType.Alertmanager,
  jsonData: {
    implementation: AlertManagerImplementation.prometheus,
    handleGrafanaManagedAlerts: true,
  },
});

const mimirDatasource = mockDataSource({
  type: DataSourceType.Alertmanager,
  name: MIMIR_DATASOURCE_UID,
  uid: MIMIR_DATASOURCE_UID,
});

describe('contact points', () => {
  beforeEach(() => {
    setupDataSources(alertManager, mimirDatasource);
  });
  describe('Contact points with Grafana managed alertmanager', () => {
    beforeEach(() => {
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);
    });

    describe('tabs behaviour', () => {
      test('loads contact points tab', async () => {
        renderWithProvider(<ContactPointsPageContents />, { initialEntries: ['/?tab=contact_points'] });

        expect(await screen.findByText(/create contact point/i)).toBeInTheDocument();
      });

      test('loads templates tab', async () => {
        renderWithProvider(<ContactPointsPageContents />, { initialEntries: ['/?tab=templates'] });

        expect(await screen.findByText(/add notification template/i)).toBeInTheDocument();
      });

      test('defaults to contact points tab with invalid query param', async () => {
        renderWithProvider(<ContactPointsPageContents />, { initialEntries: ['/?tab=foo_bar'] });

        expect(await screen.findByText(/create contact point/i)).toBeInTheDocument();
      });

      test('defaults to contact points tab with no query param', async () => {
        renderWithProvider(<ContactPointsPageContents />);

        expect(await screen.findByText(/create contact point/i)).toBeInTheDocument();
      });

      test('defaults to contact points tab if user has only read permission', async () => {
        grantUserPermissions([AccessControlAction.AlertingReceiversRead]);
        renderWithProvider(<ContactPointsPageContents />);

        expect(await screen.findByText(/create contact point/i)).toBeInTheDocument();
      });

      test('defaults to contact points tab if user has only create permission', async () => {
        grantUserPermissions([AccessControlAction.AlertingReceiversCreate]);
        renderWithProvider(<ContactPointsPageContents />);

        expect(await screen.findByText(/create contact point/i)).toBeInTheDocument();
      });
    });

    describe('templates tab', () => {
      it('does not show a warning for a "misconfigured" template', async () => {
        renderWithProvider(
          <ContactPointsPageContents />,
          { initialEntries: ['/?tab=templates'] },
          { alertmanagerSourceName: GRAFANA_RULES_SOURCE_NAME }
        );
        await screen.findByText(/create notification templates/i);
        expect(screen.queryByText(/^misconfigured$/i)).not.toBeInTheDocument();
      });
    });

    it('should show / hide loading states, have all actions enabled', async () => {
      renderWithProvider(<ContactPointsPageContents />);

      await waitForElementToBeRemoved(screen.queryByText('Loading...'));
      expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();

      expect(screen.getByText('grafana-default-email')).toBeInTheDocument();
      expect(screen.getAllByTestId('contact-point')).toHaveLength(5);

      // check for available actions – our mock 4 contact points, 1 of them is provisioned
      expect(screen.getByRole('link', { name: 'add contact point' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'export all' })).toBeInTheDocument();

      const unusedBadge = screen.getAllByLabelText('unused');
      expect(unusedBadge).toHaveLength(4);

      // Two contact points should have view buttons: grafana-default-email (cannot be edited) and provisioned-contact-point (provisioned)
      const viewButtons = screen.getAllByRole('link', { name: /^view$/i });
      expect(viewButtons).toHaveLength(2);

      // Check view buttons by their href to verify which contact points they belong to
      // The url is the same but the form should be readonly
      expect(viewButtons[0]).toHaveAttribute('href', '/alerting/notifications/receivers/grafana-default-email/edit');
      expect(viewButtons[1]).toHaveAttribute(
        'href',
        '/alerting/notifications/receivers/provisioned-contact-point/edit'
      );

      viewButtons.forEach((button) => {
        expect(button).toBeEnabled();
      });

      // Three contact points should have edit buttons: lotsa-emails, Slack with multiple channels, OnCall Contact point
      const editButtons = screen.getAllByRole('link', { name: /^edit$/i });
      expect(editButtons).toHaveLength(3);

      // Check edit buttons by their href to verify which contact points they belong to
      expect(editButtons[0]).toHaveAttribute('href', '/alerting/notifications/receivers/lotsa-emails/edit');
      expect(editButtons[1]).toHaveAttribute(
        'href',
        '/alerting/notifications/receivers/OnCall%20Conctact%20point/edit'
      );
      expect(editButtons[2]).toHaveAttribute(
        'href',
        '/alerting/notifications/receivers/Slack%20with%20multiple%20channels/edit'
      );

      editButtons.forEach((button) => {
        expect(button).toBeEnabled();
      });

      const moreActionsButtons = screen.getAllByRole('button', { name: /More/ });
      expect(moreActionsButtons).toHaveLength(5);
      moreActionsButtons.forEach((button) => {
        expect(button).toBeEnabled();
      });
    });

    it('should disable certain actions if the user has no write permissions', async () => {
      grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

      const { user } = renderWithProvider(<ContactPointsPageContents />);

      // wait for loading to be done
      await waitForElementToBeRemoved(screen.queryByText('Loading...'));

      // should disable create contact point
      expect(screen.getByRole('link', { name: 'add contact point' })).toHaveAttribute('aria-disabled', 'true');

      // edit permission is based on API response - we should have 3 buttons
      const editButtons = await screen.findAllByRole('link', { name: /^edit$/i });
      expect(editButtons).toHaveLength(3);

      // there should be view buttons though - one for provisioned, and one for the un-editable contact point
      const viewButtons = screen.getAllByRole('link', { name: /^view$/i });
      expect(viewButtons).toHaveLength(2);

      // check buttons in Notification Templates
      const notificationTemplatesTab = screen.getByRole('tab', { name: 'Notification Templates' });
      await user.click(notificationTemplatesTab);
      expect(screen.getByRole('link', { name: 'Add notification template group' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('allows deleting when not disabled', async () => {
      renderWithProvider(
        <ContactPointsPageContents />,
        { initialEntries: ['/?tab=contact_points'] },
        { alertmanagerSourceName: GRAFANA_RULES_SOURCE_NAME }
      );

      await attemptDeleteContactPoint('lotsa-emails');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should show warning when no receivers are configured', async () => {
      renderWithProvider(<ContactPoint contactPoint={basicContactPoint} />);

      expect(screen.getByText(/No integrations configured/i)).toBeInTheDocument();
    });

    it('should not show warning when at least one receiver is configured', async () => {
      const receiver: ReceiverConfigWithMetadata = {
        name: 'email',
        provenance: undefined,
        type: 'email',
        disableResolveMessage: false,
        settings: { addresses: 'test1@test.com,test2@test.com,test3@test.com,test4@test.com' },
        [RECEIVER_META_KEY]: {
          name: 'Email',
          description: 'The email receiver',
        },
      };
      renderWithProvider(
        <ContactPoint contactPoint={{ ...basicContactPoint, grafana_managed_receiver_configs: [receiver] }} />
      );
      expect(screen.queryByText(/No integrations configured/i)).not.toBeInTheDocument();
    });

    it('should disable buttons when provisioned', async () => {
      const { user } = renderWithProvider(<ContactPoint contactPoint={{ ...basicContactPoint, provisioned: true }} />);

      expect(screen.getByText(/provisioned/i)).toBeInTheDocument();

      const editAction = screen.queryByTestId('edit-action');
      expect(editAction).not.toBeInTheDocument();

      const viewAction = screen.getByRole('link', { name: /view/i });
      expect(viewAction).toBeInTheDocument();

      const moreActions = screen.getByRole('button', { name: /More/ });
      expect(moreActions).toBeEnabled();
      await user.click(moreActions);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it('should disable delete when contact point is linked to at least one normal notification policy', async () => {
      const policies: RouteReference[] = [
        {
          receiver: 'my-contact-point',
          route: {
            type: 'normal',
          },
        },
      ];

      const { user } = renderWithProvider(<ContactPoint contactPoint={{ ...basicContactPointInUse, policies }} />);

      expect(screen.getByRole('link', { name: /1 notification policy/ })).toBeInTheDocument();

      const moreActions = screen.getByRole('button', { name: /More/ });
      await user.click(moreActions);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it('should not disable delete when contact point is linked only to auto-generated notification policy', async () => {
      const policies: RouteReference[] = [
        {
          receiver: 'my-contact-point',
          route: {
            type: 'auto-generated',
          },
        },
      ];

      // Add the necessary K8s annotations to allow deletion
      const contactPointWithDeletePermission: ContactPointWithMetadata = {
        ...basicContactPoint,
        metadata: {
          annotations: {
            [K8sAnnotations.AccessDelete]: 'true',
          },
        },
        policies,
      };

      const { user } = renderWithProvider(<ContactPoint contactPoint={contactPointWithDeletePermission} />);

      const moreActions = screen.getByRole('button', { name: /More/ });
      await user.click(moreActions);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      expect(deleteButton).toBeEnabled();
    });

    it('should be able to search', async () => {
      const { user } = renderWithProvider(<ContactPointsPageContents />);

      const searchInput = await screen.findByRole('textbox', { name: 'search contact points' });
      await user.type(searchInput, 'slack');
      expect(searchInput).toHaveValue('slack');

      expect(await screen.findByText('Slack with multiple channels')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getAllByTestId('contact-point')).toHaveLength(1);
      });

      // ⚠️ for some reason, the query params are preserved for all tests so don't forget to clear the input
      const clearButton = screen.getByRole('button', { name: 'clear' });
      await user.click(clearButton);
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Contact points with Mimir-flavored alertmanager', () => {
    beforeEach(() => {
      setupMimirFlavoredServer(server);
    });

    beforeAll(() => {
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ]);
    });

    it('should show / hide loading states, have the right actions enabled', async () => {
      renderWithProvider(<ContactPointsPageContents />, undefined, { alertmanagerSourceName: MIMIR_DATASOURCE_UID });

      await waitForElementToBeRemoved(screen.queryByText('Loading...'));
      expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();

      expect(screen.getByText('mixed')).toBeInTheDocument();
      expect(screen.getByText('some webhook')).toBeInTheDocument();
      expect(screen.getAllByTestId('contact-point')).toHaveLength(2);

      // check for available actions – export should be disabled
      expect(screen.getByRole('link', { name: 'add contact point' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'export all' })).not.toBeInTheDocument();

      // 1 of them is used by a route in the mock response
      const unusedBadge = screen.getAllByLabelText('unused');
      expect(unusedBadge).toHaveLength(1);

      const editButtons = screen.getAllByRole('link', { name: /^edit$/i });
      expect(editButtons).toHaveLength(2);
      editButtons.forEach((button) => {
        expect(button).toBeEnabled();
      });

      const moreActionsButtons = screen.getAllByRole('button', { name: /More/ });
      expect(moreActionsButtons).toHaveLength(2);
      moreActionsButtons.forEach((button) => {
        expect(button).toBeEnabled();
      });
    });

    describe('templates tab', () => {
      it('shows a warning when a template is misconfigured', async () => {
        renderWithProvider(
          <ContactPointsPageContents />,
          { initialEntries: ['/?tab=templates'] },
          { alertmanagerSourceName: MIMIR_DATASOURCE_UID }
        );
        expect((await screen.findAllByText(/^misconfigured$/i))[0]).toBeInTheDocument();
      });
    });
  });

  describe('Vanilla Alertmanager ', () => {
    beforeEach(() => {
      setupVanillaAlertmanagerFlavoredServer(server);
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ]);
    });

    it("should not allow any editing because it's not supported", async () => {
      const { user } = renderWithProvider(<ContactPointsPageContents />, undefined, {
        alertmanagerSourceName: alertManager.name,
      });

      await waitForElementToBeRemoved(screen.queryByText('Loading...'));
      expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();

      expect(screen.queryByRole('link', { name: 'add contact point' })).not.toBeInTheDocument();

      const viewButton = screen.getByRole('link', { name: /^view$/i });
      expect(viewButton).toBeInTheDocument();
      expect(viewButton).toBeEnabled();

      // check buttons in Notification Templates
      const notificationTemplatesTab = screen.getByRole('tab', { name: 'Notification Templates' });
      await user.click(notificationTemplatesTab);
      expect(screen.queryByRole('link', { name: 'Add notification template group' })).not.toBeInTheDocument();
    });
  });

  describe('Grafana alertmanager', () => {
    beforeEach(() => {
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);
    });

    const renderGrafanaContactPoints = () =>
      renderWithProvider(
        <ContactPointsPageContents />,
        { initialEntries: ['/?tab=contact_points'] },
        { alertmanagerSourceName: GRAFANA_RULES_SOURCE_NAME }
      );

    it('renders list view correctly', async () => {
      renderGrafanaContactPoints();
      // Check for a specific contact point that we expect to exist in the mock AM config/k8s response
      expect(await screen.findByRole('heading', { name: 'lotsa-emails' })).toBeInTheDocument();
    });

    it('allows deleting', async () => {
      renderGrafanaContactPoints();

      await attemptDeleteContactPoint('lotsa-emails');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not allow deletion of provisioned contact points', async () => {
      renderGrafanaContactPoints();

      return expect(attemptDeleteContactPoint('provisioned-contact-point')).rejects.toBeTruthy();
    });

    it('renders number of alert rules and policies and does not permit deletion', async () => {
      const { user } = renderWithProvider(<ContactPoint contactPoint={contactPointWithEverything} />);

      expect(screen.getByText(/used by 3 alert rule/i)).toBeInTheDocument();
      expect(screen.getByText(/used by 1 notification policy/i)).toBeInTheDocument();

      await clickMoreActionsButton(contactPointWithEverything.name);
      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
      await user.hover(deleteButton);

      expect(await screen.findByText(/Contact point is referenced by one or more alert rules/i)).toBeInTheDocument();
      expect(
        await screen.findByText(/Contact point is referenced by one or more notification policies/i)
      ).toBeInTheDocument();
    });

    it('does not permit deletion when contact point is only referenced by a rule', async () => {
      const contactPointWithRule: ContactPointWithMetadata = {
        ...basicContactPoint,
        metadata: {
          annotations: {
            [K8sAnnotations.InUseRules]: '1',
          },
        },
      };
      const { user } = renderWithProvider(<ContactPoint contactPoint={contactPointWithRule} />);

      expect(screen.getByText(/used by 1 alert rule/i)).toBeInTheDocument();

      await clickMoreActionsButton(contactPointWithEverything.name);
      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
      await user.hover(deleteButton);

      expect(await screen.findByText(/Contact point is referenced by one or more alert rules/i)).toBeInTheDocument();
    });

    it('does not permit deletion when lacking permissions to delete', async () => {
      grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
      const contactPointWithoutPermissions: ContactPointWithMetadata = {
        ...contactPointWithEverything,
        metadata: {
          annotations: {
            [K8sAnnotations.AccessDelete]: 'false',
          },
        },
      };

      const { user } = renderWithProvider(<ContactPoint contactPoint={contactPointWithoutPermissions} />);

      await clickMoreActionsButton(contactPointWithEverything.name);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      await waitFor(() => expect(deleteButton).toBeDisabled());

      await user.hover(deleteButton);

      expect(
        await screen.findByText(/You do not have the required permission to delete this contact point/i)
      ).toBeInTheDocument();
    });

    it('allows deletion when there are no rules or policies referenced, and user has permission', async () => {
      grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
      const contactPointWithoutPermissions: ContactPointWithMetadata = {
        ...contactPointWithEverything,
        metadata: {
          annotations: {
            [K8sAnnotations.AccessDelete]: 'false',
          },
        },
      };

      const { user } = renderWithProvider(<ContactPoint contactPoint={contactPointWithoutPermissions} />);

      await clickMoreActionsButton(contactPointWithEverything.name);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      await waitFor(() => expect(deleteButton).toBeDisabled());

      await user.hover(deleteButton);

      expect(
        await screen.findByText(/You do not have the required permission to delete this contact point/i)
      ).toBeInTheDocument();
    });

    it('shows manage permissions and allows closing', async () => {
      const { user } = renderGrafanaContactPoints();

      await clickMoreActionsButton('lotsa-emails');

      await user.click(await screen.findByRole('menuitem', { name: /manage permissions/i }));

      const permissionsDialog = await screen.findByRole('dialog', { name: /drawer title manage permissions/i });

      expect(permissionsDialog).toBeInTheDocument();
      expect(await screen.findByRole('table')).toBeInTheDocument();

      await user.click(within(permissionsDialog).getAllByRole('button', { name: /close/i })[0]);
      expect(permissionsDialog).not.toBeInTheDocument();
    });
  });
});
