import { createBridgeURL, SupportedPlugin } from './PluginBridge';

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
