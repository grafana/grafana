import { setTestFlags } from '@grafana/test-utils/unstable';

import { FlagKeys } from '../../internal/openFeature/openfeature.gen';

import { buildAppPluginHealthUrl, buildAppPluginProxyUrl, buildAppPluginResourceUrl } from './urls';

describe('pluginBackend urls', () => {
  const pluginId = 'myorg-test-app';

  describe('when plugins.useMTPluginBackend flag is disabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPluginBackend]: false });
    });

    afterAll(() => {
      setTestFlags({});
    });

    it('buildAppPluginResourceUrl returns the legacy URL', () => {
      expect(buildAppPluginResourceUrl(pluginId, '/labels/keys')).toBe(
        '/api/plugins/myorg-test-app/resources/labels/keys'
      );
    });

    it('buildAppPluginHealthUrl returns the legacy URL', () => {
      expect(buildAppPluginHealthUrl(pluginId)).toBe('/api/plugins/myorg-test-app/health');
    });

    it('buildAppPluginProxyUrl returns the legacy URL', () => {
      expect(buildAppPluginProxyUrl(pluginId, '/foo/bar')).toBe('/api/plugin-proxy/myorg-test-app/foo/bar');
    });
  });

  describe('when plugins.useMTPluginBackend flag is enabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPluginBackend]: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    it('buildAppPluginResourceUrl returns the K8s-style URL', () => {
      expect(buildAppPluginResourceUrl(pluginId, '/labels/keys')).toBe(
        '/apis/myorg-test-app/v0alpha1/namespaces/default/app/instance/resources/labels/keys'
      );
    });

    it('buildAppPluginHealthUrl returns the K8s-style URL', () => {
      expect(buildAppPluginHealthUrl(pluginId)).toBe(
        '/apis/myorg-test-app/v0alpha1/namespaces/default/app/instance/health'
      );
    });

    it('buildAppPluginProxyUrl returns the K8s-style URL', () => {
      expect(buildAppPluginProxyUrl(pluginId, '/foo/bar')).toBe(
        '/apis/myorg-test-app/v0alpha1/namespaces/default/app/instance/proxy/foo/bar'
      );
    });

    it('buildAppPluginResourceUrl preserves query strings when they are part of path', () => {
      expect(buildAppPluginResourceUrl(pluginId, '/list?filter=all')).toBe(
        '/apis/myorg-test-app/v0alpha1/namespaces/default/app/instance/resources/list?filter=all'
      );
    });
  });
});
