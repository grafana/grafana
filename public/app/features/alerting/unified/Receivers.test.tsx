import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen, waitFor, userEvent } from 'test/test-utils';

import {
  EXTERNAL_VANILLA_ALERTMANAGER_UID,
  setupVanillaAlertmanagerServer,
} from 'app/features/alerting/unified/components/settings/__mocks__/server';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import ContactPoints from './Receivers';

import 'core-js/stable/structured-clone';

const server = setupMswServer();

const mockDataSources = {
  [EXTERNAL_VANILLA_ALERTMANAGER_UID]: mockDataSource<AlertManagerDataSourceJsonData>({
    uid: EXTERNAL_VANILLA_ALERTMANAGER_UID,
    name: EXTERNAL_VANILLA_ALERTMANAGER_UID,
    type: DataSourceType.Alertmanager,
    jsonData: {
      implementation: AlertManagerImplementation.prometheus,
    },
  }),
};

beforeEach(() => {
  grantUserPermissions([
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsWrite,
    AccessControlAction.AlertingNotificationsExternalRead,
    AccessControlAction.AlertingNotificationsExternalWrite,
  ]);
});

it('can save a contact point with a select dropdown', async () => {
  setupVanillaAlertmanagerServer(server);
  setupDataSources(mockDataSources[EXTERNAL_VANILLA_ALERTMANAGER_UID]);

  const user = userEvent.setup();

  render(<ContactPoints />, {
    historyOptions: {
      initialEntries: [`/alerting/notifications/receivers/new?alertmanager=${EXTERNAL_VANILLA_ALERTMANAGER_UID}`],
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

  await user.click(await screen.findByRole('button', { name: /save contact point/i }));

  // TODO: Have a better way to assert that the contact point was saved. This is instead asserting on some
  // text that's present on the list page, as there's a lot of overlap in text between the form and the list page
  await waitFor(() => expect(screen.getByText(/search by name or type/i)).toBeInTheDocument(), { timeout: 2000 });
});
