import { screen, render } from '@testing-library/react';
import React from 'react';

import { backendSrv } from 'app/core/services/backend_srv';

import { createBridgeURL, PluginBridge, SupportedPlugin } from './PluginBridge';
import { server, NON_EXISTING_PLUGIN } from './PluginBridge.mock';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('createBridgeURL', () => {
  it('should work with path', () => {
    expect(createBridgeURL(SupportedPlugin.Incident, '/incidents/declare')).toBe(
      '/a/grafana-incident-app/incidents/declare'
    );
  });

  it('should work with path and options', () => {
    expect(createBridgeURL(SupportedPlugin.Incident, '/incidents/declare', { title: 'My Incident' })).toBe(
      '/a/grafana-incident-app/incidents/declare?title=My+Incident'
    );
  });
});

describe('<PluginBridge />', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should render notInstalled component', async () => {
    // @ts-ignore
    render(<PluginBridge plugin={NON_EXISTING_PLUGIN} notInstalledComponent={<div>plugin not installed</div>} />);
    expect(await screen.findByText('plugin not installed')).toBeInTheDocument();
  });

  it('should render loading and installed component', async () => {
    const pluginId = SupportedPlugin.Incident;
    render(
      <PluginBridge plugin={pluginId} loadingComponent={<>Loading...</>}>
        Plugin installed!
      </PluginBridge>
    );
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
    expect(await screen.findByText('Plugin installed!')).toBeInTheDocument();
  });
});
