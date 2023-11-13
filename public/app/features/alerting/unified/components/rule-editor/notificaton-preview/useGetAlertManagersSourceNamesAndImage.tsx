import { AlertmanagerChoice } from '../../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../../api/alertmanagerApi';
import {
  getExternalDsAlertManagers,
  GRAFANA_RULES_SOURCE_NAME,
  isVanillaPrometheusAlertManagerDataSource,
} from '../../../utils/datasource';

export interface AlertManagerMetaData {
  name: string;
  img: string;
  postable: boolean;
}

export const useGetAlertManagersMetadata = () => {
  //get current alerting config
  const { currentData: amConfigStatus } = alertmanagerApi.useGetAlertmanagerChoiceStatusQuery(undefined);

  const externalDsAlertManagers = getExternalDsAlertManagers().map((ds) => ({
    name: ds.name,
    img: ds.meta.info.logos.small,
    postable: isVanillaPrometheusAlertManagerDataSource(ds.name),
  }));

  const alertmanagerChoice = amConfigStatus?.alertmanagersChoice;
  const grafanaAlertManagerMetaData: AlertManagerMetaData = {
    name: GRAFANA_RULES_SOURCE_NAME,
    img: 'public/img/grafana_icon.svg',
    postable: true,
  };
  const alertManagerMetaData: AlertManagerMetaData[] =
    alertmanagerChoice === AlertmanagerChoice.Internal
      ? [grafanaAlertManagerMetaData]
      : alertmanagerChoice === AlertmanagerChoice.External
      ? externalDsAlertManagers
      : [grafanaAlertManagerMetaData, ...externalDsAlertManagers];

  return alertManagerMetaData;
};
