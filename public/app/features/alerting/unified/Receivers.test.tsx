import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen, waitFor, userEvent } from 'test/test-utils';

import {
  PROVISIONED_MIMIR_ALERTMANAGER_UID,
  mockDataSources,
  setupVanillaAlertmanagerServer,
} from 'app/features/alerting/unified/components/settings/__mocks__/server';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { AccessControlAction } from 'app/types';

import ContactPoints from './Receivers';

import 'core-js/stable/structured-clone';

const server = setupMswServer();

const assertSaveWasSuccessful = async () => {
  // TODO: Have a better way to assert that the contact point was saved. This is instead asserting on some
  // text that's present on the list page, as there's a lot of overlap in text between the form and the list page
  return waitFor(() => expect(screen.getByText(/search by name or type/i)).toBeInTheDocument(), { timeout: 2000 });
};

const saveContactPoint = async () => {
  const user = userEvent.setup();
  return user.click(await screen.findByRole('button', { name: /save contact point/i }));
};

beforeEach(() => {
  grantUserPermissions([
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsWrite,
    AccessControlAction.AlertingNotificationsExternalRead,
    AccessControlAction.AlertingNotificationsExternalWrite,
  ]);

  setupVanillaAlertmanagerServer(server);
  setupDataSources(mockDataSources[PROVISIONED_MIMIR_ALERTMANAGER_UID]);
});

it('can save a contact point with a select dropdown', async () => {
  const user = userEvent.setup();

  render(<ContactPoints />, {
    historyOptions: {
      initialEntries: [
        {
          pathname: `/alerting/notifications/receivers/new`,
          search: `?alertmanager=${PROVISIONED_MIMIR_ALERTMANAGER_UID}`,
        },
      ],
    },
  });

  // Fill out contact point name
  const contactPointName = await screen.findByPlaceholderText(/name/i);
  await user.type(contactPointName, 'contact point with select');

  // Select Telegram option (this is we expect the form to contain a dropdown)
  const integrationDropdown = screen.getByLabelText(/integration/i);
  await selectOptionInTest(integrationDropdown, /telegram/i);

  // Fill out basic fields necessary for contact point to be saved
  const botToken = await screen.findByLabelText(/bot token/i);
  const chatId = await screen.findByLabelText(/chat id/i);

  await user.type(botToken, 'sometoken');
  await user.type(chatId, '-123');

  await saveContactPoint();

  await assertSaveWasSuccessful();
});

it('can save existing Telegram contact point', async () => {
  render(<ContactPoints />, {
    historyOptions: {
      initialEntries: [
        {
          pathname: `/alerting/notifications/receivers/Telegram/edit`,
          search: `?alertmanager=${PROVISIONED_MIMIR_ALERTMANAGER_UID}`,
        },
      ],
    },
  });

  // Here, we're implicitly testing that our parsing of an existing Telegram integration works correctly
  // Our mock server will reject a request if we've sent the Chat ID as `0`,
  // so opening and trying to save an existing Telegram integration should
  // trigger this error if it regresses
  await saveContactPoint();

  await assertSaveWasSuccessful();
});
