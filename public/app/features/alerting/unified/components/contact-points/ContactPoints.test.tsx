import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React, { ComponentProps, PropsWithChildren } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import ContactPoints, { ContactPoint } from './ContactPoints';
import setupGrafanaManagedServer from './__mocks__/grafanaManagedServer';
import setupMimirFlavoredServer, { MIMIR_DATASOURCE_UID } from './__mocks__/mimirFlavoredServer';
import setupVanillaAlertmanagerFlavoredServer, {
  VANILLA_ALERTMANAGER_DATASOURCE_UID,
} from './__mocks__/vanillaAlertmanagerServer';

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

const renderWithProvider = (
  providerProps?: Partial<ComponentProps<typeof AlertmanagerProvider>>,
  contactPointProps?: Partial<ComponentProps<typeof ContactPoints>>
) =>
  render(
    <TestProvider>
      <AlertmanagerProvider accessType={'notification'} {...providerProps}>
        <ContactPoints {...contactPointProps} />
      </AlertmanagerProvider>
    </TestProvider>
  );

describe('contact points', () => {
  beforeEach(() => {
    // The location service is stateful between tests - `TestProvider` uses the same instance between each test
    // and this results in the query params being persisted between tests
    // To get round this for now, we can push "/" onto the history so there are no query params
    locationService.push('/');
  });

  describe('Contact points with Grafana managed alertmanager', () => {
    beforeEach(() => {
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);

      setupGrafanaManagedServer(server);
    });

    describe('tabs behaviour', () => {
      test('loads contact points tab', async () => {
        locationService.push('/?tab=contact_points');
        renderWithProvider();

        expect(await screen.findByText(/add contact point/i)).toBeInTheDocument();
      });

      test('loads templates tab', async () => {
        locationService.push('/?tab=templates');
        renderWithProvider();

        expect(await screen.findByText(/add notification template/i)).toBeInTheDocument();
      });

      test('defaults to contact points tab with invalid query param', async () => {
        locationService.push('/?tab=foo_bar');
        renderWithProvider();

        expect(await screen.findByText(/add contact point/i)).toBeInTheDocument();
      });

      test('defaults to contact points tab with no query param', async () => {
        renderWithProvider();

        expect(await screen.findByText(/add contact point/i)).toBeInTheDocument();
      });
    });

    it('should show / hide loading states, have all actions enabled', async () => {
      renderWithProvider();

      await waitFor(async () => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        await waitForElementToBeRemoved(screen.getByText('Loading...'));
        expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
      });

      expect(screen.getByText('grafana-default-email')).toBeInTheDocument();
      expect(screen.getAllByTestId('contact-point')).toHaveLength(5);

      // check for available actions – our mock 4 contact points, 1 of them is provisioned
      expect(screen.getByRole('link', { name: 'add contact point' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'export all' })).toBeInTheDocument();

      // 2 of them are unused by routes in the mock response
      const unusedBadge = screen.getAllByLabelText('unused');
      expect(unusedBadge).toHaveLength(3);

      const viewProvisioned = screen.getByRole('link', { name: 'view-action' });
      expect(viewProvisioned).toBeInTheDocument();
      expect(viewProvisioned).not.toBeDisabled();

      const editButtons = screen.getAllByRole('link', { name: 'edit-action' });
      expect(editButtons).toHaveLength(4);
      editButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });

      const moreActionsButtons = screen.getAllByRole('button', { name: 'more-actions' });
      expect(moreActionsButtons).toHaveLength(5);
      moreActionsButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should disable certain actions if the user has no write permissions', async () => {
      grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

      renderWithProvider();

      // wait for loading to be done
      await waitFor(async () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // should disable create contact point
      expect(screen.getByRole('link', { name: 'add contact point' })).toHaveAttribute('aria-disabled', 'true');

      // there should be no edit buttons
      expect(screen.queryAllByRole('link', { name: 'edit-action' })).toHaveLength(0);

      // there should be view buttons though
      const viewButtons = screen.getAllByRole('link', { name: 'view-action' });
      expect(viewButtons).toHaveLength(5);

      // delete should be disabled in the "more" actions
      const moreButtons = screen.queryAllByRole('button', { name: 'more-actions' });
      expect(moreButtons).toHaveLength(5);

      // check if all of the delete buttons are disabled
      for await (const button of moreButtons) {
        await userEvent.click(button);
        const deleteButton = screen.queryByRole('menuitem', { name: 'delete' });
        expect(deleteButton).toBeDisabled();
        // click outside the menu to close it otherwise we can't interact with the rest of the page
        await userEvent.click(document.body);
      }

      // check buttons in Notification Templates
      const notificationTemplatesTab = screen.getByRole('tab', { name: 'Tab Notification Templates' });
      await userEvent.click(notificationTemplatesTab);
      expect(screen.getByRole('link', { name: 'Add notification template' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('should call delete when clicked and not disabled', async () => {
      const onDelete = jest.fn();

      render(<ContactPoint name={'my-contact-point'} receivers={[]} onDelete={onDelete} />, {
        wrapper,
      });

      const moreActions = screen.getByRole('button', { name: 'more-actions' });
      await userEvent.click(moreActions);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      await userEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith('my-contact-point');
    });

    it('should disable edit button', async () => {
      render(<ContactPoint name={'my-contact-point'} disabled={true} receivers={[]} onDelete={noop} />, {
        wrapper,
      });

      const moreActions = screen.getByRole('button', { name: 'more-actions' });
      expect(moreActions).not.toBeDisabled();

      const editAction = screen.getByTestId('edit-action');
      expect(editAction).toHaveAttribute('aria-disabled', 'true');
    });

    it('should disable buttons when provisioned', async () => {
      render(<ContactPoint name={'my-contact-point'} provisioned={true} receivers={[]} onDelete={noop} />, {
        wrapper,
      });

      expect(screen.getByText(/provisioned/i)).toBeInTheDocument();

      const editAction = screen.queryByTestId('edit-action');
      expect(editAction).not.toBeInTheDocument();

      const viewAction = screen.getByRole('link', { name: /view/i });
      expect(viewAction).toBeInTheDocument();

      const moreActions = screen.getByRole('button', { name: 'more-actions' });
      expect(moreActions).not.toBeDisabled();
      await userEvent.click(moreActions);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it('should disable delete when contact point is linked to at least one notification policy', async () => {
      render(
        <ContactPoint name={'my-contact-point'} provisioned={true} receivers={[]} policies={1} onDelete={noop} />,
        {
          wrapper,
        }
      );

      expect(screen.getByRole('link', { name: 'is used by 1 notification policy' })).toBeInTheDocument();

      const moreActions = screen.getByRole('button', { name: 'more-actions' });
      await userEvent.click(moreActions);

      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it('should be able to search', async () => {
      renderWithProvider();

      const searchInput = screen.getByRole('textbox', { name: 'search contact points' });
      await userEvent.type(searchInput, 'slack');
      expect(searchInput).toHaveValue('slack');

      await waitFor(() => {
        expect(screen.getByText('Slack with multiple channels')).toBeInTheDocument();
        expect(screen.getAllByTestId('contact-point')).toHaveLength(1);
      });

      // ⚠️ for some reason, the query params are preserved for all tests so don't forget to clear the input
      const clearButton = screen.getByRole('button', { name: 'clear' });
      await userEvent.click(clearButton);
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
      setupDataSources(
        mockDataSource({
          type: DataSourceType.Alertmanager,
          name: MIMIR_DATASOURCE_UID,
          uid: MIMIR_DATASOURCE_UID,
        })
      );
    });

    it('should show / hide loading states, have the right actions enabled', async () => {
      renderWithProvider({ alertmanagerSourceName: MIMIR_DATASOURCE_UID });

      await waitFor(async () => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        await waitForElementToBeRemoved(screen.getByText('Loading...'));
        expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
      });

      expect(screen.getByText('mixed')).toBeInTheDocument();
      expect(screen.getByText('some webhook')).toBeInTheDocument();
      expect(screen.getAllByTestId('contact-point')).toHaveLength(2);

      // check for available actions – export should be disabled
      expect(screen.getByRole('link', { name: 'add contact point' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'export all' })).not.toBeInTheDocument();

      // 1 of them is used by a route in the mock response
      const unusedBadge = screen.getAllByLabelText('unused');
      expect(unusedBadge).toHaveLength(1);

      const editButtons = screen.getAllByRole('link', { name: 'edit-action' });
      expect(editButtons).toHaveLength(2);
      editButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });

      const moreActionsButtons = screen.getAllByRole('button', { name: 'more-actions' });
      expect(moreActionsButtons).toHaveLength(2);
      moreActionsButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
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

      const alertManager = mockDataSource<AlertManagerDataSourceJsonData>({
        name: VANILLA_ALERTMANAGER_DATASOURCE_UID,
        uid: VANILLA_ALERTMANAGER_DATASOURCE_UID,
        type: DataSourceType.Alertmanager,
        jsonData: {
          implementation: AlertManagerImplementation.prometheus,
          handleGrafanaManagedAlerts: true,
        },
      });

      setupDataSources(alertManager);
    });

    it("should not allow any editing because it's not supported", async () => {
      render(
        <TestProvider>
          <AlertmanagerProvider
            accessType={'notification'}
            alertmanagerSourceName={VANILLA_ALERTMANAGER_DATASOURCE_UID}
          >
            <ContactPoints />
          </AlertmanagerProvider>
        </TestProvider>
      );

      await waitFor(async () => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        await waitForElementToBeRemoved(screen.getByText('Loading...'));
        expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
      });

      expect(screen.queryByRole('link', { name: 'add contact point' })).not.toBeInTheDocument();

      const viewProvisioned = screen.getByRole('link', { name: 'view-action' });
      expect(viewProvisioned).toBeInTheDocument();
      expect(viewProvisioned).not.toBeDisabled();

      // check buttons in Notification Templates
      const notificationTemplatesTab = screen.getByRole('tab', { name: 'Tab Notification Templates' });
      await userEvent.click(notificationTemplatesTab);
      expect(screen.queryByRole('link', { name: 'Add notification template' })).not.toBeInTheDocument();
    });
  });
});

const wrapper = ({ children }: PropsWithChildren) => (
  <TestProvider>
    <AlertmanagerProvider accessType={'notification'}>{children}</AlertmanagerProvider>
  </TestProvider>
);
