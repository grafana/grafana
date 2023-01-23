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
    },
    azureCloudOptions: [
      { value: 'azuremonitor', label: 'Azure' },
      { value: 'govazuremonitor', label: 'Azure US Government' },
      { value: 'chinaazuremonitor', label: 'Azure China' },
    ],
    onCredentialsChange: jest.fn(),
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

  describe('when disabled', () => {
    it('should disable inputs', async () => {
      setup((props) => ({
        ...props,
        disabled: true,
      }));

      await waitFor(() => screen.getByLabelText('Azure Cloud'));
      expect(screen.getByLabelText('Azure Cloud')).toBeDisabled();
    });
  });
});
