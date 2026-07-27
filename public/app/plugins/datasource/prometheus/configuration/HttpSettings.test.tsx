import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceSettings } from '@grafana/data';
import { type PromOptions } from '@grafana/prometheus';

import { HttpSettings } from './HttpSettings';

// Replace Auth with a test double that exposes onAuthMethodSelect as buttons,
// so we can test the callback logic without depending on the Auth component's internal UI.
jest.mock('@grafana/plugin-ui', () => ({
  ...jest.requireActual('@grafana/plugin-ui'),
  Auth: ({ onAuthMethodSelect }: { onAuthMethodSelect: (method: string) => void }) => (
    <div>
      <button onClick={() => onAuthMethodSelect('BasicAuth')}>Basic auth</button>
      <button onClick={() => onAuthMethodSelect('OAuthForward')}>Forward OAuth Identity</button>
      <button onClick={() => onAuthMethodSelect('CrossSiteCredentials')}>Cross-site credentials</button>
    </div>
  ),
}));

function createDefaultConfigOptions(): DataSourceSettings<PromOptions> {
  return {
    jsonData: {},
    secureJsonFields: {},
    access: 'proxy',
    basicAuth: false,
    withCredentials: false,
  } as DataSourceSettings<PromOptions>;
}

describe('HttpSettings', () => {
  it('renders without error', () => {
    expect(() =>
      render(
        <HttpSettings
          options={createDefaultConfigOptions()}
          onOptionsChange={() => {}}
          secureSocksDSProxyEnabled={false}
        />
      )
    ).not.toThrow();
  });

  it('renders the Prometheus server URL input', () => {
    render(
      <HttpSettings
        options={createDefaultConfigOptions()}
        onOptionsChange={() => {}}
        secureSocksDSProxyEnabled={false}
      />
    );
    expect(screen.getByPlaceholderText('http://localhost:9090')).toBeInTheDocument();
  });

  it('shows SecureSocksProxy settings when enabled', () => {
    render(
      <HttpSettings
        options={createDefaultConfigOptions()}
        onOptionsChange={() => {}}
        secureSocksDSProxyEnabled={true}
      />
    );
    expect(screen.getByText('Secure Socks Proxy')).toBeInTheDocument();
  });

  it('hides SecureSocksProxy settings when disabled', () => {
    render(
      <HttpSettings
        options={createDefaultConfigOptions()}
        onOptionsChange={() => {}}
        secureSocksDSProxyEnabled={false}
      />
    );
    expect(screen.queryByText('Secure Socks Proxy')).not.toBeInTheDocument();
  });

  it('calls onOptionsChange with basicAuth:true when BasicAuth is selected', async () => {
    const onOptionsChange = jest.fn();
    render(
      <HttpSettings
        options={createDefaultConfigOptions()}
        onOptionsChange={onOptionsChange}
        secureSocksDSProxyEnabled={false}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Basic auth' }));
    expect(onOptionsChange).toHaveBeenCalledWith(expect.objectContaining({ basicAuth: true, withCredentials: false }));
  });

  it('calls onOptionsChange with oauthPassThru:true when OAuthForward is selected', async () => {
    const onOptionsChange = jest.fn();
    render(
      <HttpSettings
        options={createDefaultConfigOptions()}
        onOptionsChange={onOptionsChange}
        secureSocksDSProxyEnabled={false}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Forward OAuth Identity' }));
    expect(onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        basicAuth: false,
        withCredentials: false,
        jsonData: expect.objectContaining({ oauthPassThru: true }),
      })
    );
  });

  it('calls onOptionsChange with withCredentials:true when CrossSiteCredentials is selected', async () => {
    const onOptionsChange = jest.fn();
    render(
      <HttpSettings
        options={createDefaultConfigOptions()}
        onOptionsChange={onOptionsChange}
        secureSocksDSProxyEnabled={false}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cross-site credentials' }));
    expect(onOptionsChange).toHaveBeenCalledWith(expect.objectContaining({ basicAuth: false, withCredentials: true }));
  });
});
