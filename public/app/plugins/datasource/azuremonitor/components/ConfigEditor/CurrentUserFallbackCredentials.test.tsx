import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { selectors } from '../../e2e/selectors';

import CurrentUserFallbackCredentials, { Props } from './CurrentUserFallbackCredentials';

const setup = (propsFunc?: (props: Props) => Props) => {
  let props: Props = {
    managedIdentityEnabled: true,
    workloadIdentityEnabled: true,
    credentials: { authType: 'currentuser' },
    azureCloudOptions: [
      { value: 'AzureCloud', label: 'Azure' },
      { value: 'AzureUSGovernment', label: 'Azure US Government' },
      { value: 'AzureChinaCloud', label: 'Azure China' },
    ],
    onCredentialsChange: jest.fn(),
  };

  if (propsFunc) {
    props = propsFunc(props);
  }

  return { ...render(<CurrentUserFallbackCredentials {...props} />), props };
};

jest.mock('@grafana/runtime', () => ({
  ___esModule: true,
  ...jest.requireActual('@grafana/runtime'),
}));

describe('CurrentUserFallbackCredentials', () => {
  it('should render alert if fallback credentials disabled', async () => {
    setup();

    expect(screen.getByText('Fallback Credentials Disabled')).toBeInTheDocument();
  });

  it('should render component', async () => {
    jest.mocked(config).azure.userIdentityFallbackCredentialsEnabled = true;
    setup();

    await waitFor(() =>
      expect(
        screen.queryByTestId(selectors.components.configEditor.serviceCredentialsEnabled.button)
      ).toBeInTheDocument()
    );
  });

  it('should enable service credentials', async () => {
    jest.mocked(config).azure.userIdentityFallbackCredentialsEnabled = true;
    const onCredentialsChange = jest.fn();
    const { rerender, props } = setup((props) => ({
      ...props,
      onCredentialsChange,
    }));

    await waitFor(() => fireEvent.click(screen.getByLabelText('Enabled')));
    expect(onCredentialsChange).toHaveBeenCalled();
    expect(onCredentialsChange).toHaveBeenCalledWith({ authType: 'currentuser', serviceCredentialsEnabled: true });

    rerender(
      <CurrentUserFallbackCredentials
        {...props}
        credentials={{ ...props.credentials, serviceCredentialsEnabled: true }}
      />
    );
    expect(screen.getByText('Authentication')).toBeInTheDocument();
  });
});
