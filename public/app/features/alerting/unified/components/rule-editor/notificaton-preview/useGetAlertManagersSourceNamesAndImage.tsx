import { AlertmanagerChoice } from '../../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { getExternalDsAlertManagers, GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

export interface AlertManagerMetaData {
  name: string;
  img: string;
}

export const useGetAlertManagersMetadata = () => {
  //get current alerting config
  const { currentData: amConfigStatus } = alertmanagerApi.useGetAlertmanagerChoiceStatusQuery(undefined);

  const externalDsAlertManagers = getExternalDsAlertManagers().map((ds) => ({
    name: ds.name,
    img: ds.meta.info.logos.small,
  }));

  const alertmanagerChoice = amConfigStatus?.alertmanagersChoice;
  const grafanaAlertManagerMetaData: AlertManagerMetaData = {
    name: GRAFANA_RULES_SOURCE_NAME,
    img: 'public/img/grafana_icon.svg',
  };

  switch (alertmanagerChoice) {
    case AlertmanagerChoice.Internal:
      return [grafanaAlertManagerMetaData];
    case AlertmanagerChoice.External:
      return externalDsAlertManagers;
    default:
      return [grafanaAlertManagerMetaData, ...externalDsAlertManagers];
  }
};
