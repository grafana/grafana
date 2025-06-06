import { render, screen } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { SupportedPlugin } from '../types/pluginBridges';

import { PluginBridge, createBridgeURL } from './PluginBridge';
const NON_EXISTING_PLUGIN = '__does_not_exist__';
setupMswServer();

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
