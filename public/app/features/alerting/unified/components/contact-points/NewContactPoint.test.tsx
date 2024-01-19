import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byLabelText, byPlaceholderText, byRole, byTestId } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import NewContactPoint from './NewContactPoint';
import setupGrafanaManagedServer, {
  setupSaveEndpointMock,
  setupTestEndpointMock,
} from './__mocks__/grafanaManagedServer';

import 'core-js/stable/structured-clone';

const server = setupMswServer();
const user = userEvent.setup();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
  setupGrafanaManagedServer(server);
});

it('should be able to test and save a receiver', async () => {
  const testMock = setupTestEndpointMock(server);
  const saveMock = setupSaveEndpointMock(server);

  render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName="grafana">
      <NewContactPoint />
    </AlertmanagerProvider>,
    { wrapper: TestProvider }
  );

  // wait for loading to be done
  // type in a name for the new receiver
  await waitFor(() => {
    user.type(ui.inputs.name.get(), 'my new receiver');
  });

  // enter some email
  const email = ui.inputs.email.addresses.get();
  await user.clear(email);
  await user.type(email, 'tester@grafana.com');

  // try to test the contact point
  await user.click(await ui.testContactPointButton.find());

  await waitFor(
    () => {
      expect(ui.testContactPointModal.get()).toBeInTheDocument();
    },
    { timeout: 1000 }
  );
  await user.click(ui.customContactPointOption.get());

  // enter custom annotations and labels
  await user.type(screen.getByPlaceholderText('Enter a description...'), 'Test contact point');
  await user.type(ui.contactPointLabelKey(0).get(), 'foo');
  await user.type(ui.contactPointLabelValue(0).get(), 'bar');

  // click test
  await user.click(ui.testContactPoint.get());

  // we shouldn't be testing implementation details but when the request is successful
  // it can't seem to assert on the success toast
  await waitFor(() => {
    expect(testMock).toHaveBeenCalled();
    expect(testMock.mock.lastCall).toMatchSnapshot();
  });

  await user.click(ui.saveContactButton.get());
  await waitFor(() => {
    expect(saveMock).toHaveBeenCalled();
    expect(saveMock.mock.lastCall).toMatchSnapshot();
  });
});

const ui = {
  saveContactButton: byRole('button', { name: /save contact point/i }),
  newContactPointIntegrationButton: byRole('button', { name: /add contact point integration/i }),
  testContactPointButton: byRole('button', { name: /Test/ }),
  testContactPointModal: byRole('heading', { name: /test contact point/i }),
  customContactPointOption: byRole('radio', { name: /custom/i }),
  contactPointAnnotationSelect: (idx: number) => byTestId(`annotation-key-${idx}`),
  contactPointAnnotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
  contactPointLabelKey: (idx: number) => byTestId(`label-key-${idx}`),
  contactPointLabelValue: (idx: number) => byTestId(`label-value-${idx}`),
  testContactPoint: byRole('button', { name: /send test notification/i }),
  cancelButton: byTestId('cancel-button'),

  channelFormContainer: byTestId('item-container'),

  inputs: {
    name: byPlaceholderText('Name'),
    email: {
      addresses: byLabelText(/Addresses/),
      toEmails: byLabelText(/To/),
    },
    hipchat: {
      url: byLabelText('Hip Chat Url'),
      apiKey: byLabelText('API Key'),
    },
    slack: {
      webhookURL: byLabelText(/Webhook URL/i),
    },
    webhook: {
      URL: byLabelText(/The endpoint to send HTTP POST requests to/i),
    },
  },
};
