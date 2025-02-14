import { PluginMeta, PluginType } from '@grafana/data';

import { throwIfAngularPlugin } from './throwIfAngularPlugin';

const plugin: PluginMeta = {
  id: 'test',
  name: 'Test',
  type: PluginType.datasource,
  info: {
    author: { name: 'Test', url: 'https://test.com' },
    description: 'Test',
    links: [],
    logos: { large: '', small: '' },
    screenshots: [],
    updated: '2021-01-01',
    version: '1.0.0',
  },
  module: 'test',
  baseUrl: 'test',
};

describe('throwIfAngularPlugin', () => {
  it('should throw if angular plugin', () => {
    const meta = { ...plugin, angular: { detected: true, hideDeprecation: false } };
    expect(() => throwIfAngularPlugin(meta)).toThrow('Angular plugins are not supported');
  });

  it('should throw if angular plugin', () => {
    const meta = { ...plugin, angularDetected: true };
    expect(() => throwIfAngularPlugin(meta)).toThrow('Angular plugins are not supported');
  });

  it('should not throw if not angular plugin', () => {
    const meta = { ...plugin, angular: { detected: false, hideDeprecation: false } };
    expect(() => throwIfAngularPlugin(meta)).not.toThrow();
  });
});
