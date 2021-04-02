import { getBackendSrv } from '@grafana/runtime';
import { AlertmanagerCortexConfig, AlertmanagerCortexConfigDTO } from 'app/plugins/datasource/alertmanager/types';
import { getDatasourceAPIId } from '../utils/datasource';

// "grafana" for grafana-managed, otherwise a datasource name
export async function getAlertmanagerConfig(alertmanagerSourceName: string): Promise<AlertmanagerCortexConfig> {
  const conf: AlertmanagerCortexConfigDTO = await getBackendSrv().get(
    `/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/config/api/v1/alerts`
  );
  return {
    template_files: conf.template_files,
    alertmanager_config: JSON.parse(conf.alertmanager_config),
  };
}

export async function updateAlertmanagerConfig(
  alertmanagerSourceName: string,
  config: AlertmanagerCortexConfig
): Promise<void> {
  const payload: AlertmanagerCortexConfigDTO = {
    template_files: config.template_files,
    alertmanager_config: JSON.stringify(config.alertmanager_config),
  };
  await getBackendSrv().post(
    `/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/config/api/v1/alerts`,
    payload
  );
}
