import { AlertmanagerChoice } from '../../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { getExternalDsAlertManagers, GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
export const useGetAlertManagersSourceNamesAndImage = () => {
    //get current alerting config
    const { currentData: amConfigStatus } = alertmanagerApi.useGetAlertmanagerChoiceStatusQuery(undefined);
    const externalDsAlertManagers = getExternalDsAlertManagers().map((ds) => ({
        name: ds.name,
        img: ds.meta.info.logos.small,
    }));
    const alertmanagerChoice = amConfigStatus === null || amConfigStatus === void 0 ? void 0 : amConfigStatus.alertmanagersChoice;
    const alertManagerSourceNamesWithImage = alertmanagerChoice === AlertmanagerChoice.Internal
        ? [{ name: GRAFANA_RULES_SOURCE_NAME, img: 'public/img/grafana_icon.svg' }]
        : alertmanagerChoice === AlertmanagerChoice.External
            ? externalDsAlertManagers
            : [{ name: GRAFANA_RULES_SOURCE_NAME, img: 'public/img/grafana_icon.svg' }, ...externalDsAlertManagers];
    return alertManagerSourceNamesWithImage;
};
//# sourceMappingURL=useGetAlertManagersSourceNamesAndImage.js.map