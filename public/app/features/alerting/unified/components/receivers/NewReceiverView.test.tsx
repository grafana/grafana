import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen } from 'test/test-utils';
import { byLabelText, byPlaceholderText, byRole, byTestId } from 'testing-library-selector';

import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { makeAllK8sEndpointsFail } from '../../mocks/server/configure';

import NewReceiverView from './NewReceiverView';

setupMswServer();

const Index = () => {
  return <div>redirected</div>;
};

const renderForm = () =>
  render(
    <Routes>
      <Route path="/alerting/notifications" element={<Index />} />
      <Route path="/alerting/notifications/new" element={<NewReceiverView />} />
    </Routes>,
    {
      historyOptions: { initialEntries: ['/alerting/notifications/new'] },
    }
  );

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
});

describe('new receiver', () => {
  it('can create a receiver', async () => {
    const { user } = renderForm();

    expect(await ui.inputs.name.find()).toBeEnabled();

    await user.type(await ui.inputs.name.find(), 'my new receiver');

    // enter some email
    const email = ui.inputs.email.addresses.get();
    await user.clear(email);
    await user.type(email, 'tester@grafana.com');

    await user.click(ui.saveContactButton.get());

    expect(await screen.findByText(/redirected/i)).toBeInTheDocument();
  });

  it('should be able to test and save a receiver', async () => {
    const capture = captureRequests();

    const { user } = renderForm();

    // wait for loading to be done
    // type in a name for the new receiver
    await user.type(await ui.inputs.name.find(), 'my new receiver');

    // enter some email
    const email = ui.inputs.email.addresses.get();
    await user.clear(email);
    await user.type(email, 'tester@grafana.com');

    // try to test the contact point
    await user.click(await ui.testContactPointButton.find());

    expect(await ui.testContactPointModal.find()).toBeInTheDocument();

    await user.click(ui.customContactPointOption.get());

    // enter custom annotations and labels
    await user.type(screen.getByPlaceholderText('Enter a description...'), 'Test contact point');
    await user.type(ui.contactPointLabelKey(0).get(), 'foo');
    await user.type(ui.contactPointLabelValue(0).get(), 'bar');

    // click test
    await user.click(ui.testContactPoint.get());

    // we shouldn't be testing implementation details but when the request is successful
    // it can't seem to assert on the success toast
    await user.click(ui.saveContactButton.get());

    const requests = await capture;
    const testRequest = requests.find((r) => r.url.endsWith('/config/api/v1/receivers/test'));
    const saveRequest = requests.find((r) => r.url.endsWith('/receivers') && r.method === 'POST');

    const testBody = await testRequest?.json();
    const saveBody = await saveRequest?.json();

    expect([testBody]).toMatchSnapshot();
    expect([saveBody]).toMatchSnapshot();
  });

  it('does not redirect when creating contact point and API errors', async () => {
    const { user } = renderForm();

    await user.type(await ui.inputs.name.find(), 'receiver that should fail');
    const email = ui.inputs.email.addresses.get();
    await user.clear(email);
    await user.type(email, 'tester@grafana.com');

    makeAllK8sEndpointsFail('someerror');

    await user.click(ui.saveContactButton.get());

    expect(screen.queryByText(/redirected/i)).not.toBeInTheDocument();
  });
});

const ui = {
  saveContactButton: byRole('button', { name: /save contact point/i }),

  testContactPointButton: byRole('button', { name: /Test/ }),
  testContactPointModal: byRole('heading', { name: /test contact point/i }),
  customContactPointOption: byRole('radio', { name: /custom/i }),
  contactPointLabelKey: (idx: number) => byTestId(`label-key-${idx}`),
  contactPointLabelValue: (idx: number) => byTestId(`label-value-${idx}`),
  testContactPoint: byRole('button', { name: /send test notification/i }),
  inputs: {
    name: byPlaceholderText('Name'),
    email: {
      addresses: byLabelText(/Addresses/),
    },
  },
};
