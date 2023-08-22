import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';

import { disableRBAC } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import ContactPoints, { ContactPoint } from './ContactPoints.v2';
import setupGrafanaManagedServer from './__mocks__/grafanaManagedServer';
import setupMimirFlavoredServer from './__mocks__/mimirFlavoredServer';

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
 */
describe('ContactPoints', () => {
  beforeAll(() => {
    disableRBAC();
  });

  describe('Grafana managed alertmanager', () => {
    setupGrafanaManagedServer();

    it('should show / hide loading states', async () => {
      render(
        <AlertmanagerProvider accessType={'notification'}>
          <ContactPoints />
        </AlertmanagerProvider>,
        { wrapper: TestProvider }
      );

      await waitFor(async () => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        await waitForElementToBeRemoved(screen.getByText('Loading...'));
        expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
      });

      expect(screen.getByText('grafana-default-email')).toBeInTheDocument();
      expect(screen.getAllByTestId('contact-point')).toHaveLength(4);
    });
  });

  describe('Mimir-flavored alertmanager', () => {
    setupMimirFlavoredServer();

    it('should show / hide loading states', async () => {
      render(
        <AlertmanagerProvider accessType={'notification'} context={{ selectedAlertmanager: 'mimir' }}>
          <ContactPoints />
        </AlertmanagerProvider>,
        { wrapper: TestProvider }
      );

      await waitFor(async () => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        await waitForElementToBeRemoved(screen.getByText('Loading...'));
        expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
      });

      expect(screen.getByText('grafana-default-email')).toBeInTheDocument();
      expect(screen.getAllByTestId('contact-point')).toHaveLength(4);
    });
  });
});

describe('ContactPoint', () => {
  it('should call delete when clicked and not disabled', async () => {
    const onDelete = jest.fn();

    render(<ContactPoint name={'my-contact-point'} receivers={[]} onDelete={onDelete} />);

    const moreActions = screen.getByTestId('more-actions');
    await userEvent.click(moreActions);

    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await userEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith('my-contact-point');
  });

  it('should disable edit button', async () => {
    render(<ContactPoint name={'my-contact-point'} disabled={true} receivers={[]} onDelete={noop} />);

    const moreActions = screen.getByTestId('more-actions');
    expect(moreActions).not.toBeDisabled();

    const editAction = screen.getByTestId('edit-action');
    expect(editAction).toHaveAttribute('aria-disabled', 'true');
  });

  it('should disable buttons when provisioned', async () => {
    render(<ContactPoint name={'my-contact-point'} provisioned={true} receivers={[]} onDelete={noop} />);

    expect(screen.getByText(/provisioned/i)).toBeInTheDocument();

    const editAction = screen.queryByTestId('edit-action');
    expect(editAction).not.toBeInTheDocument();

    const viewAction = screen.getByRole('link', { name: /view/i });
    expect(viewAction).toBeInTheDocument();

    const moreActions = screen.getByTestId('more-actions');
    expect(moreActions).not.toBeDisabled();
    await userEvent.click(moreActions);

    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });
});
