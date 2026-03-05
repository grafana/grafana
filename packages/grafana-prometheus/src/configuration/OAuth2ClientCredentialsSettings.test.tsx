import { render, screen } from '@testing-library/react';

import { createDefaultConfigOptions } from '../test/mocks/datasource';

import { OAuth2ClientCredentialsSettings } from './OAuth2ClientCredentialsSettings';

describe('OAuth2ClientCredentialsSettings', () => {
  it('should render all OAuth2 client credentials fields', () => {
    const options = createDefaultConfigOptions();
    const onOptionsChange = jest.fn();

    render(<OAuth2ClientCredentialsSettings options={options} onOptionsChange={onOptionsChange} />);

    expect(screen.getByPlaceholderText('Enter Client ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter Client Secret')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://auth.example.com/oauth2/token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('read, write')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('audience=https://api.example.com&resource=my-resource')).toBeInTheDocument();
  });

  it('should display configured values', () => {
    const options = {
      ...createDefaultConfigOptions(),
      jsonData: {
        ...createDefaultConfigOptions().jsonData,
        oauth2ClientCredentials: true,
        oauth2ClientId: 'my-client-id',
        oauth2TokenUrl: 'https://auth.example.com/token',
        oauth2Scopes: 'read,write',
        oauth2EndpointParams: 'audience=https://api.example.com',
      },
    };
    const onOptionsChange = jest.fn();

    render(<OAuth2ClientCredentialsSettings options={options} onOptionsChange={onOptionsChange} />);

    expect(screen.getByDisplayValue('my-client-id')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://auth.example.com/token')).toBeInTheDocument();
    expect(screen.getByDisplayValue('read,write')).toBeInTheDocument();
    expect(screen.getByDisplayValue('audience=https://api.example.com')).toBeInTheDocument();
  });

  it('should show the wrapper test id', () => {
    const options = createDefaultConfigOptions();
    const onOptionsChange = jest.fn();

    render(<OAuth2ClientCredentialsSettings options={options} onOptionsChange={onOptionsChange} />);

    expect(screen.getByTestId('oauth2-client-credentials-settings')).toBeInTheDocument();
  });
});
