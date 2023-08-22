import { AlertmanagerChoice } from '../../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { useExternalDataSourceAlertmanagers } from '../../../hooks/useExternalAmSelector';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

export interface AlertManagerNameWithImage {
  name: string;
  img: string;
}

export const useGetAlertManagersSourceNamesAndImage = () => {
  //get current alerting config
  const { currentData: amConfigStatus } = alertmanagerApi.useGetAlertmanagerChoiceStatusQuery(undefined);

  const externalDsAlertManagers: AlertManagerNameWithImage[] = useExternalDataSourceAlertmanagers().map((ds) => ({
    name: ds.dataSource.name,
    img: ds.dataSource.meta.info.logos.small,
  }));
  const alertmanagerChoice = amConfigStatus?.alertmanagersChoice;
  const alertManagerSourceNamesWithImage: AlertManagerNameWithImage[] =
    alertmanagerChoice === AlertmanagerChoice.Internal
      ? [{ name: GRAFANA_RULES_SOURCE_NAME, img: 'public/img/grafana_icon.svg' }]
      : alertmanagerChoice === AlertmanagerChoice.External
      ? externalDsAlertManagers
      : [{ name: GRAFANA_RULES_SOURCE_NAME, img: 'public/img/grafana_icon.svg' }, ...externalDsAlertManagers];

  return alertManagerSourceNamesWithImage;
};
