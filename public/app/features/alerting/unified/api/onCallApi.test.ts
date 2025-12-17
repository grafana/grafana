import { config } from '@grafana/runtime';

import { pluginMeta, pluginMetaToPluginConfig } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import { getProxyApiUrl } from './onCallApi';

describe('getProxyApiUrl', () => {
  it('should return URL with IRM plugin ID when IRM plugin is present', () => {
    // eslint-disable-next-line no-restricted-syntax
    config.apps = { [SupportedPlugin.Irm]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Irm]) };

    expect(getProxyApiUrl('/alert_receive_channels/')).toBe(
      '/api/plugins/grafana-irm-app/resources/alert_receive_channels/'
    );
  });

  it('should return URL with OnCall plugin ID when IRM plugin is not present', () => {
    // eslint-disable-next-line no-restricted-syntax
    config.apps = {
      [SupportedPlugin.OnCall]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.OnCall]),
      [SupportedPlugin.Incident]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Incident]),
    };

    expect(getProxyApiUrl('/alert_receive_channels/')).toBe(
      '/api/plugins/grafana-oncall-app/resources/alert_receive_channels/'
    );
  });
});
