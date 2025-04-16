import { render, screen, within } from 'test/test-utils';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { NotificationTemplates } from './NotificationTemplates';

const renderWithProvider = () => {
  return render(
    <AlertmanagerProvider accessType={'notification'}>
      <NotificationTemplates />
      <AppNotificationList />
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

  it('Should render templates table with the correct rows', async () => {
    renderWithProvider();

    const slackRow = await screen.findByRole('row', { name: /slack-template/i });
    expect(within(slackRow).getByRole('cell', { name: /slack-template/i })).toBeInTheDocument();

    const emailRow = await screen.findByRole('row', { name: /custom-email/i });
    expect(within(emailRow).getByRole('cell', { name: /custom-email/i })).toBeInTheDocument();

    const provisionedRow = await screen.findByRole('row', { name: /provisioned-template/i });
    expect(within(provisionedRow).getByRole('cell', { name: /provisioned-template/i })).toBeInTheDocument();
  });

  it('Should provisioned badge for provisioned template', async () => {
    renderWithProvider();

    const provisionedRow = await screen.findByRole('row', { name: /provisioned-template/i });
    expect(within(provisionedRow).getByText('Provisioned')).toBeInTheDocument();
  });

  it('Should delete template', async () => {
    const { user } = renderWithProvider();

    const emailRow = await screen.findByRole('row', { name: /custom-email/i });
    const deleteEmailButton = within(emailRow).getByRole('button', { name: /delete template/i });

    await user.click(deleteEmailButton);

    const confirmDeleteButton = await screen.findByRole('button', { name: /Yes, delete/i });
    await user.click(confirmDeleteButton);

    expect(screen.queryByRole('row', { name: /custom-email/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('status', { name: 'Template deleted' })).toHaveTextContent(
      'Template custom-email has been deleted'
    );
  });
});
