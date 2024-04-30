import { config } from '@grafana/runtime';

import { mockCombinedRule } from '../mocks';

import { GRAFANA_ORIGIN_LABEL } from './labels';
import { getRulePluginOrigin } from './rules';

describe('getRuleOrigin', () => {
  it('returns undefined when no origin label is present', () => {
    const rule = mockCombinedRule({
      labels: {},
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when origin label does not match expected format', () => {
    const rule = mockCombinedRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'invalid_format' },
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns undefined when plugin is not installed', () => {
    const rule = mockCombinedRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/uninstalled_plugin' },
    });
    expect(getRulePluginOrigin(rule)).toBeUndefined();
  });

  it('returns pluginId when origin label matches expected format and plugin is installed', () => {
    config.apps = {
      installed_plugin: {
        id: 'installed_plugin',
        version: '',
        path: '',
        preload: true,
        angular: { detected: false, hideDeprecation: false },
      },
    };
    const rule = mockCombinedRule({
      labels: { [GRAFANA_ORIGIN_LABEL]: 'plugin/installed_plugin' },
    });
    expect(getRulePluginOrigin(rule)).toEqual({ pluginId: 'installed_plugin' });
  });
});
