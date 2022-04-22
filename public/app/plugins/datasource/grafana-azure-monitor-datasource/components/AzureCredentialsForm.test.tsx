import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import AzureCredentialsForm, { Props } from './AzureCredentialsForm';

const setup = (propsFunc?: (props: Props) => Props) => {
  let props: Props = {
    managedIdentityEnabled: false,
    credentials: {
      authType: 'clientsecret',
      azureCloud: 'azuremonitor',
      tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
      clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
      clientSecret: undefined,
      defaultSubscriptionId: '44987801-6nn6-49he-9b2d-9106972f9789',
    },
    azureCloudOptions: [
      { value: 'azuremonitor', label: 'Azure' },
      { value: 'govazuremonitor', label: 'Azure US Government' },
      { value: 'germanyazuremonitor', label: 'Azure Germany' },
      { value: 'chinaazuremonitor', label: 'Azure China' },
    ],
    onCredentialsChange: jest.fn(),
    getSubscriptions: jest.fn(() => Promise.resolve([])),
  };

  if (propsFunc) {
    props = propsFunc(props);
  }

  return render(<AzureCredentialsForm {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    setup();

    expect(screen.getByText('Azure Cloud')).toBeInTheDocument();
  });

  it('should disable azure monitor secret input', async () => {
    setup((props) => ({
      ...props,
      credentials: {
        authType: 'clientsecret',
        azureCloud: 'azuremonitor',
        tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
        clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
        clientSecret: Symbol(),
      },
    }));
    await waitFor(() => screen.getByTestId('client-secret'));
    expect(screen.getByTestId('client-secret')).toBeDisabled();
  });

  it('should enable azure monitor load subscriptions button', async () => {
    setup((props) => ({
      ...props,
      credentials: {
        authType: 'clientsecret',
        azureCloud: 'azuremonitor',
        tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
        clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
        clientSecret: 'e7f3f661-a933-4b3f-8176-51c4f982ec48',
      },
    }));
    await waitFor(() => expect(screen.getByText('Load Subscriptions')).toBeInTheDocument());
  });

  describe('when disabled', () => {
    it('should disable inputs', async () => {
      setup((props) => ({
        ...props,
        disabled: true,
      }));

      await waitFor(() => screen.getByLabelText('Azure Cloud'));
      expect(screen.getByLabelText('Azure Cloud')).toBeDisabled();
    });

    it('should remove buttons', async () => {
      setup((props) => ({
        ...props,
        disabled: true,
      }));
      await waitFor(() => expect(screen.queryByText('Load Subscriptions')).not.toBeInTheDocument());
    });

    it('should render children components', () => {
      setup((props) => ({
        ...props,
        children: <button>click me</button>,
      }));
      expect(screen.getByText('click me')).toBeInTheDocument();
    });
  });
});
