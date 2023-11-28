import { countBy, keyBy } from 'lodash';
import { useSelector } from 'app/types';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { getAlertManagerDataSources } from '../utils/datasource';
export function useExternalDataSourceAlertmanagers() {
    const { useGetExternalAlertmanagersQuery } = alertmanagerApi;
    const { currentData: discoveredAlertmanagers } = useGetExternalAlertmanagersQuery();
    const externalDsAlertManagers = getAlertManagerDataSources().filter((ds) => ds.jsonData.handleGrafanaManagedAlerts);
    const alertmanagerDatasources = useSelector((state) => keyBy(state.dataSources.dataSources.filter((ds) => ds.type === 'alertmanager'), (ds) => ds.uid));
    const droppedAMUrls = countBy(discoveredAlertmanagers === null || discoveredAlertmanagers === void 0 ? void 0 : discoveredAlertmanagers.droppedAlertManagers, (x) => x.url);
    const activeAMUrls = countBy(discoveredAlertmanagers === null || discoveredAlertmanagers === void 0 ? void 0 : discoveredAlertmanagers.activeAlertManagers, (x) => x.url);
    return externalDsAlertManagers.map((dsAm) => {
        var _a, _b;
        const dsSettings = alertmanagerDatasources[dsAm.uid];
        if (!dsSettings) {
            return {
                dataSource: dsAm,
                status: 'pending',
            };
        }
        const amUrl = getDataSourceUrlWithProtocol(dsSettings);
        const amStatusUrl = `${amUrl}/api/v2/alerts`;
        const matchingDroppedUrls = (_a = droppedAMUrls[amStatusUrl]) !== null && _a !== void 0 ? _a : 0;
        const matchingActiveUrls = (_b = activeAMUrls[amStatusUrl]) !== null && _b !== void 0 ? _b : 0;
        const isDropped = matchingDroppedUrls > 0;
        const isActive = matchingActiveUrls > 0;
        // Multiple Alertmanagers of the same URL may exist (e.g. with different credentials)
        // Alertmanager response only contains URLs, so in case of duplication, we are not able
        // to distinguish which is which, resulting in an inconclusive status.
        const isStatusInconclusive = matchingDroppedUrls + matchingActiveUrls > 1;
        const status = isDropped ? 'dropped' : isActive ? 'active' : 'pending';
        return {
            dataSource: dsAm,
            url: dsSettings.url,
            status,
            statusInconclusive: isStatusInconclusive,
        };
    });
}
function getDataSourceUrlWithProtocol(dsSettings) {
    const hasProtocol = new RegExp('^[^:]*://').test(dsSettings.url);
    if (!hasProtocol) {
        return `http://${dsSettings.url}`; // Grafana append http protocol if there is no any
    }
    return dsSettings.url;
}
//# sourceMappingURL=useExternalAmSelector.js.map