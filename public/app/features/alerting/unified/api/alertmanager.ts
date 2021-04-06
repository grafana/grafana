import { getBackendSrv } from '@grafana/runtime';
import { AlertManagerCortexConfig, AlertManagerCortexConfigDTO } from 'app/plugins/datasource/alertmanager/types';
import { getDatasourceAPIId } from '../utils/datasource';

// "grafana" for grafana-managed, otherwise a datasource name
export async function fetchAlertManagerConfig(alertmanagerSourceName: string): Promise<AlertManagerCortexConfig> {
  const conf = await getBackendSrv()
    .fetch<AlertManagerCortexConfigDTO>({
      url: `/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/config/api/v1/alerts`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();
  return {
    template_files: conf.data.template_files,
    alertmanager_config: JSON.parse(conf.data.alertmanager_config),
  };
}

export async function updateAlertmanagerConfig(
  alertmanagerSourceName: string,
  config: AlertManagerCortexConfig
): Promise<void> {
  const payload: AlertManagerCortexConfigDTO = {
    template_files: config.template_files,
    alertmanager_config: JSON.stringify(config.alertmanager_config),
  };
  await getBackendSrv().post(
    `/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/config/api/v1/alerts`,
    payload
  );
}
