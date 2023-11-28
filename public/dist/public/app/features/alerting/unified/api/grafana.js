import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { getDatasourceAPIUid } from '../utils/datasource';
export function fetchNotifiers() {
    return getBackendSrv().get(`/api/alert-notifiers`);
}
export const parseIntegrationName = (integrationName) => {
    const matches = integrationName.match(/^(\w+)(\[\d+\])?$/);
    if (!matches) {
        return { type: integrationName, index: undefined };
    }
    return {
        type: matches[1],
        index: matches[2],
    };
};
export const contactPointsStateDtoToModel = (receiversStateDto) => {
    // init object to return
    const contactPointsState = { receivers: {}, errorCount: 0 };
    // for each receiver from response
    receiversStateDto.forEach((cpState) => {
        //init receiver state
        contactPointsState.receivers[cpState.name] = { active: cpState.active, notifiers: {}, errorCount: 0 };
        const receiverState = contactPointsState.receivers[cpState.name];
        //update integrations in response
        cpState.integrations.forEach((integrationStatusDTO) => {
            //update errorcount
            const hasError = Boolean(integrationStatusDTO === null || integrationStatusDTO === void 0 ? void 0 : integrationStatusDTO.lastNotifyAttemptError);
            if (hasError) {
                receiverState.errorCount += 1;
            }
            //add integration for this type
            const integrationType = getIntegrationType(integrationStatusDTO.name);
            if (integrationType) {
                //if type still does not exist in IntegrationsTypeState we initialize it with an empty array
                if (!receiverState.notifiers[integrationType]) {
                    receiverState.notifiers[integrationType] = [];
                }
                // add error status for this type
                receiverState.notifiers[integrationType].push(integrationStatusDTO);
            }
        });
    });
    const errorsCount = Object.values(contactPointsState.receivers).reduce((prevCount, receiverState) => prevCount + receiverState.errorCount, 0);
    return Object.assign(Object.assign({}, contactPointsState), { errorCount: errorsCount });
};
export const getIntegrationType = (integrationName) => { var _a; return (_a = parseIntegrationName(integrationName)) === null || _a === void 0 ? void 0 : _a.type; };
export function fetchContactPointsState(alertManagerSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield lastValueFrom(getBackendSrv().fetch({
                url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/receivers`,
                showErrorAlert: false,
                showSuccessAlert: false,
            }));
            return contactPointsStateDtoToModel(response.data);
        }
        catch (error) {
            return contactPointsStateDtoToModel([]);
        }
    });
}
//# sourceMappingURL=grafana.js.map