import { type PluginMeta, PluginType } from '../types/plugin';

import { matchPluginId } from './matchPluginId';

const createPluginMeta = (id: string, aliasIDs?: string[]): PluginMeta => ({
  id,
  name: 'Test Plugin',
  type: PluginType.datasource,
  module: 'test',
  baseUrl: 'test',
  info: {
    author: { name: 'Test' },
    description: 'Test',
    links: [],
    logos: { small: '', large: '' },
    screenshots: [],
    updated: '',
    version: '',
  },
  aliasIDs,
});

describe('matchPluginId', () => {
  it('should match exact plugin ID', () => {
    const pluginMeta = createPluginMeta('test-plugin');
    expect(matchPluginId('test-plugin', pluginMeta)).toBe(true);
  });

  it('should not match different plugin ID', () => {
    const pluginMeta = createPluginMeta('test-plugin');
    expect(matchPluginId('different-plugin', pluginMeta)).toBe(false);
  });

  it('should match Amazon Prometheus flavor when idToMatch is prometheus', () => {
    const pluginMeta = createPluginMeta('grafana-amazonprometheus-datasource');
    expect(matchPluginId('prometheus', pluginMeta)).toBe(true);
  });

  it('should match Azure Prometheus flavor when idToMatch is prometheus', () => {
    const pluginMeta = createPluginMeta('grafana-azureprometheus-datasource');
    expect(matchPluginId('prometheus', pluginMeta)).toBe(true);
  });

  it('should not match non-prometheus flavor when idToMatch is prometheus', () => {
    const pluginMeta = createPluginMeta('test-plugin');
    expect(matchPluginId('prometheus', pluginMeta)).toBe(false);
  });

  it('should match alias IDs', () => {
    const pluginMeta = createPluginMeta('test-plugin', ['alias1', 'alias2']);
    expect(matchPluginId('alias1', pluginMeta)).toBe(true);
    expect(matchPluginId('alias2', pluginMeta)).toBe(true);
  });

  it('should not match non-existent alias ID', () => {
    const pluginMeta = createPluginMeta('test-plugin', ['alias1', 'alias2']);
    expect(matchPluginId('alias3', pluginMeta)).toBe(false);
  });

  it('should handle undefined aliasIDs', () => {
    const pluginMeta = createPluginMeta('test-plugin');
    expect(matchPluginId('alias1', pluginMeta)).toBe(false);
  });

  describe('with a partial plugin meta (id/aliasIDs only)', () => {
    it('should match an exact id', () => {
      expect(matchPluginId('prometheus', { id: 'prometheus' })).toBe(true);
    });

    it('should match a Prometheus flavor id', () => {
      expect(matchPluginId('prometheus', { id: 'grafana-amazonprometheus-datasource' })).toBe(true);
      expect(matchPluginId('prometheus', { id: 'grafana-azureprometheus-datasource' })).toBe(true);
    });

    it('should not match a non-Prometheus id', () => {
      expect(matchPluginId('prometheus', { id: 'loki' })).toBe(false);
    });

    it('should match against aliasIDs', () => {
      expect(matchPluginId('alias1', { id: 'test-plugin', aliasIDs: ['alias1'] })).toBe(true);
    });
  });
});
