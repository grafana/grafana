import { screen, render } from '@testing-library/react';
import React from 'react';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { SupportedPlugin } from '../types/pluginBridges';

import { createBridgeURL, PluginBridge } from './PluginBridge';
import { server, NON_EXISTING_PLUGIN } from './PluginBridge.mock';

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
  it('should render notInstalled component', async () => {
    render(<PluginBridge plugin={NON_EXISTING_PLUGIN} notInstalledFallback={<div>plugin not installed</div>} />);
    expect(await screen.findByText('plugin not installed')).toBeInTheDocument();
  });

  it('should render loading and installed component', async () => {
    render(
      <PluginBridge plugin={SupportedPlugin.Incident} loadingComponent={<>Loading...</>}>
        Plugin installed!
      </PluginBridge>
    );
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
    expect(await screen.findByText('Plugin installed!')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
