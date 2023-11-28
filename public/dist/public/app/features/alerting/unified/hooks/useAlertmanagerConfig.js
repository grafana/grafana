import { alertmanagerApi } from '../api/alertmanagerApi';
// TODO refactor this so we can just call "alertmanagerApi.endpoints.getAlertmanagerConfiguration" everywhere
// and remove this hook since it adds little value
export function useAlertmanagerConfig(amSourceName, options) {
    const fetchConfig = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(amSourceName !== null && amSourceName !== void 0 ? amSourceName : '', Object.assign(Object.assign({}, options), { skip: !amSourceName }));
    return Object.assign(Object.assign({}, fetchConfig), { 
        // TODO refactor to get rid of this type assertion
        error: fetchConfig.error });
}
//# sourceMappingURL=useAlertmanagerConfig.js.map