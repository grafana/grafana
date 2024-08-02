import { render, screen, within } from 'test/test-utils';

import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { NotificationTemplates } from './NotificationTemplates';

const renderWithProvider = () => {
  render(
    <AlertmanagerProvider accessType={'notification'}>
      <NotificationTemplates />
    </AlertmanagerProvider>
  );
};

setupMswServer();

describe('NotificationTemplates', () => {
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

    const slackRow = await screen.findByRole('row', { name: /slack-template/i });
    expect(within(slackRow).getByRole('cell', { name: /slack-template/i })).toBeInTheDocument();

    const emailRow = await screen.findByRole('row', { name: /custom-email/i });
    expect(within(emailRow).getByRole('cell', { name: /custom-email/i })).toBeInTheDocument();

    const provisionedRow = await screen.findByRole('row', { name: /provisioned-template/i });
    expect(within(provisionedRow).getByRole('cell', { name: /provisioned-template/i })).toBeInTheDocument();
  });

  it('Should render duplicate template button when having permissions', async () => {
    renderWithProvider();

    const slackRow = await screen.findByRole('row', { name: /slack-template/i });
    expect(within(slackRow).getByRole('cell', { name: /Copy/i })).toBeInTheDocument();
  });

  it('Should not render duplicate template button when not having write permissions', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsExternalRead,
    ]);

    renderWithProvider();

    const slackRow = await screen.findByRole('row', { name: /slack-template/i });
    expect(within(slackRow).queryByRole('cell', { name: /Copy/i })).not.toBeInTheDocument();

    const emailRow = await screen.findByRole('row', { name: /custom-email/i });
    expect(within(emailRow).queryByRole('cell', { name: /Copy/i })).not.toBeInTheDocument();
  });

  it('shows provisioned badge appropriately', async () => {
    renderWithProvider();

    const provisionedRow = await screen.findByRole('row', { name: /provisioned-template/i });
    expect(within(provisionedRow).getByText('Provisioned')).toBeInTheDocument();
  });
});
