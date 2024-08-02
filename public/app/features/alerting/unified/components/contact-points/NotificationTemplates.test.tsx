import { screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import { render } from 'test/test-utils';
import { byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { NotificationTemplates } from './NotificationTemplates';

const ui = {
  loadingPlaceholder: byText('Loading notification templates'),
};

const renderWithProvider = () => {
  render(
    <AlertmanagerProvider accessType={'notification'}>
      <NotificationTemplates />
    </AlertmanagerProvider>
  );
};

setupMswServer();

describe('TemplatesTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
    ]);
  });

  it('Should render templates table with the correct rows', async () => {
    renderWithProvider();
    await waitForElementToBeRemoved(ui.loadingPlaceholder.query());

    const slackRow = screen.getByRole('row', { name: /slack-template/i });
    expect(within(slackRow).getByRole('cell', { name: /slack-template/i })).toBeInTheDocument();

    const emailRow = screen.getByRole('row', { name: /custom-email/i });
    expect(within(emailRow).getByRole('cell', { name: /custom-email/i })).toBeInTheDocument();

    const provisionedRow = screen.getByRole('row', { name: /provisioned-template/i });
    expect(within(provisionedRow).getByRole('cell', { name: /provisioned-template/i })).toBeInTheDocument();
  });

  it('Should render duplicate template button when having permissions', async () => {
    renderWithProvider();

    await waitForElementToBeRemoved(ui.loadingPlaceholder.query());

    const slackRow = screen.getByRole('row', { name: /slack-template/i });
    expect(within(slackRow).getByRole('cell', { name: /Copy/i })).toBeInTheDocument();
  });

  it('Should not render duplicate template button when not having write permissions', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsExternalRead,
    ]);

    renderWithProvider();

    await waitForElementToBeRemoved(ui.loadingPlaceholder.query());

    const slackRow = screen.getByRole('row', { name: /slack-template/i });
    expect(within(slackRow).queryByRole('cell', { name: /Copy/i })).not.toBeInTheDocument();

    const emailRow = screen.getByRole('row', { name: /custom-email/i });
    expect(within(emailRow).queryByRole('cell', { name: /Copy/i })).not.toBeInTheDocument();
  });
});
