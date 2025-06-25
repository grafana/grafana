import { render, screen } from '@testing-library/react';

import AzureCredentialsForm, { Props } from './AzureCredentialsForm';

const setup = (propsFunc?: (props: Props) => Props) => {
  let props: Props = {
    managedIdentityEnabled: false,
    workloadIdentityEnabled: false,
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
    getSubscriptions: jest.fn().mockResolvedValue([]),
  };

  if (propsFunc) {
    props = propsFunc(props);
  }

  render(<AzureCredentialsForm {...props} />);
};

describe('AzureCredentialsForm', () => {
  it('should render without error', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should disable azure monitor secret input when the clientSecret is a symbol', async () => {
    setup((props) => ({
      ...props,
      credentials: {
        ...props.credentials,
        clientSecret: Symbol(),
      },
    }));
    expect(await screen.findByLabelText('Client Secret')).toBeDisabled();
  });
});
