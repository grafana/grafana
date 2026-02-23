import irmLogoSvg from 'img/alerting/irm_logo.svg';
import oncallLogoSvg from 'img/alerting/oncall_logo.svg';

import { SupportedPlugin } from '../../../types/pluginBridges';

export const GRAFANA_APP_RECEIVERS_SOURCE_IMAGE: Record<SupportedPlugin, string> = {
  [SupportedPlugin.OnCall]: oncallLogoSvg,
  [SupportedPlugin.Irm]: irmLogoSvg,
  [SupportedPlugin.Incident]: '',
  [SupportedPlugin.MachineLearning]: '',
  [SupportedPlugin.Labels]: '',
  [SupportedPlugin.Slo]: '',
};
