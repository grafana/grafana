import { SupportedPlugin } from '../types/pluginBridges';

import { getProxyApiUrl } from './onCallApi';

describe('getProxyApiUrl', () => {
  it('should return URL with IRM plugin ID when IRM plugin ID is passed', () => {
    expect(getProxyApiUrl('/alert_receive_channels/', SupportedPlugin.Irm)).toBe(
      '/api/plugins/grafana-irm-app/resources/alert_receive_channels/'
    );
  });

  it('should return URL with OnCall plugin ID when OnCall plugin ID is passed', () => {
    expect(getProxyApiUrl('/alert_receive_channels/', SupportedPlugin.OnCall)).toBe(
      '/api/plugins/grafana-oncall-app/resources/alert_receive_channels/'
    );
  });
});
