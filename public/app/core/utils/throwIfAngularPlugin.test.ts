import { PanelPlugin, PluginMeta, PluginType } from '@grafana/data';

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
    const underTest = { ...plugin, angular: { detected: true, hideDeprecation: false } };
    expect(() => throwIfAngularPlugin(underTest)).toThrow('Angular plugins are not supported');
  });

  it('should throw if angular plugin', () => {
    const underTest = { ...plugin, angularDetected: true };
    expect(() => throwIfAngularPlugin(underTest)).toThrow('Angular plugins are not supported');
  });

  it('should throw if angular panel', () => {
    const underTest = new PanelPlugin(null);
    underTest.angularPanelCtrl = {};
    expect(() => throwIfAngularPlugin(underTest)).toThrow('Angular plugins are not supported');
  });

  it('should throw if angular module', () => {
    const underTest: System.Module = { PanelCtrl: {} };
    expect(() => throwIfAngularPlugin(underTest)).toThrow('Angular plugins are not supported');
  });

  it('should not throw if not angular plugin', () => {
    const underTest = { ...plugin, angular: { detected: false, hideDeprecation: false } };
    expect(() => throwIfAngularPlugin(underTest)).not.toThrow();
  });

  it('should not throw if not angular panel', () => {
    const underTest = new PanelPlugin(null);
    expect(() => throwIfAngularPlugin(underTest)).not.toThrow();
  });

  it('should not throw if not angular module', () => {
    const underTest: System.Module = {};
    expect(() => throwIfAngularPlugin(underTest)).not.toThrow();
  });
});
