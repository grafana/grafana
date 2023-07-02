import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import ContactPoints, { ContactPointsListItem } from './ContactPoints.v2';

/**
 * These test are kinda bad to maintain – here's what we should do instead.
 *
 * 1. Make sure we have "dumb" components we can test without mocking data, use these for writing assertions
 *    on what the component should look like
 * 2. For testing the "smart" components, just check if the hooks are being called. If they are it means we're probably fetching data
 * 3. Write tests for the hooks we call in the "smart" components to check if we are _indeed_ fetching data
 *    and if loading / error states are being propagated correctly.
 */

describe('Contact Points', () => {
  it('should show / hide loading states', async () => {
    render(
      <TestProvider>
        <ContactPoints />
      </TestProvider>
    );

    await waitFor(async () => {
      await expect(screen.getByText('Loading...')).toBeInTheDocument();
      await waitForElementToBeRemoved(screen.getByText('Loading...'));
    });
  });

  it('should render a single item', () => {
    render(<ContactPointsListItem name={'my-contact-point'} receivers={[]} onDelete={noop} />);

    // should render the header
    expect(screen.getByText('my-contact-point')).toBeInTheDocument();
    expect(screen.getByText('is not used in any policy')).toBeInTheDocument();
  });

  it('should call delete when clicked and not disabled', async () => {
    const onDelete = jest.fn();

    render(<ContactPointsListItem name={'my-contact-point'} receivers={[]} onDelete={onDelete} />);

    const moreActions = screen.getByTestId('more-actions');
    await userEvent.click(moreActions);

    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await userEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith('my-contact-point');
  });

  it('should disabled buttons', async () => {
    render(<ContactPointsListItem name={'my-contact-point'} disabled={true} receivers={[]} onDelete={noop} />);

    const moreActions = screen.getByTestId('more-actions');
    const editAction = screen.getByTestId('edit-action');

    expect(moreActions).toHaveProperty('disabled', true);
    expect(editAction).toHaveProperty('disabled', true);
  });

  it('should disabled buttons when provisioned', async () => {
    render(<ContactPointsListItem name={'my-contact-point'} provisioned={true} receivers={[]} onDelete={noop} />);

    expect(screen.getByText(/provisioned/i)).toBeInTheDocument();

    const moreActions = screen.getByTestId('more-actions');
    const editAction = screen.getByTestId('edit-action');

    expect(moreActions).toHaveProperty('disabled', true);
    expect(editAction).toHaveProperty('disabled', true);
  });
});
