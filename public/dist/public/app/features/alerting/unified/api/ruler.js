import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { prepareRulesFilterQueryParams } from './prometheus';
export function rulerUrlBuilder(rulerConfig) {
    const grafanaServerPath = `/api/ruler/${getDatasourceAPIUid(rulerConfig.dataSourceName)}`;
    const rulerPath = `${grafanaServerPath}/api/v1/rules`;
    const rulerSearchParams = new URLSearchParams();
    rulerSearchParams.set('subtype', rulerConfig.apiVersion === 'legacy' ? 'cortex' : 'mimir');
    return {
        rules: (filter) => {
            const params = prepareRulesFilterQueryParams(rulerSearchParams, filter);
            return {
                path: `${rulerPath}`,
                params: params,
            };
        },
        namespace: (namespace) => ({
            path: `${rulerPath}/${encodeURIComponent(namespace)}`,
            params: Object.fromEntries(rulerSearchParams),
        }),
        namespaceGroup: (namespace, group) => ({
            path: `${rulerPath}/${encodeURIComponent(namespace)}/${encodeURIComponent(group)}`,
            params: Object.fromEntries(rulerSearchParams),
        }),
    };
}
// upsert a rule group. use this to update rule
export function setRulerRuleGroup(rulerConfig, namespace, group) {
    return __awaiter(this, void 0, void 0, function* () {
        const { path, params } = rulerUrlBuilder(rulerConfig).namespace(namespace);
        yield lastValueFrom(getBackendSrv().fetch({
            method: 'POST',
            url: path,
            data: group,
            showErrorAlert: false,
            showSuccessAlert: false,
            params,
        }));
    });
}
// fetch all ruler rule namespaces and included groups
export function fetchRulerRules(rulerConfig, filter) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((filter === null || filter === void 0 ? void 0 : filter.dashboardUID) && rulerConfig.dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
            throw new Error('Filtering by dashboard UID is only supported by Grafana.');
        }
        // TODO Move params creation to the rules function
        const { path: url, params } = rulerUrlBuilder(rulerConfig).rules(filter);
        return rulerGetRequest(url, {}, params);
    });
}
// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export function fetchRulerRulesNamespace(rulerConfig, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const { path, params } = rulerUrlBuilder(rulerConfig).namespace(namespace);
        const result = yield rulerGetRequest(path, {}, params);
        return result[namespace] || [];
    });
}
// fetch a particular rule group
// will throw with { status: 404 } if rule group does not exist
export function fetchTestRulerRulesGroup(dataSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        return rulerGetRequest(`/api/ruler/${getDatasourceAPIUid(dataSourceName)}/api/v1/rules/test/test`, null);
    });
}
export function fetchRulerRulesGroup(rulerConfig, namespace, group) {
    return __awaiter(this, void 0, void 0, function* () {
        const { path, params } = rulerUrlBuilder(rulerConfig).namespaceGroup(namespace, group);
        return rulerGetRequest(path, null, params);
    });
}
export function deleteRulerRulesGroup(rulerConfig, namespace, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        const { path, params } = rulerUrlBuilder(rulerConfig).namespaceGroup(namespace, groupName);
        yield lastValueFrom(getBackendSrv().fetch({
            url: path,
            method: 'DELETE',
            showSuccessAlert: false,
            showErrorAlert: false,
            params,
        }));
    });
}
// false in case ruler is not supported. this is weird, but we'll work on it
function rulerGetRequest(url, empty, params) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield lastValueFrom(getBackendSrv().fetch({
                url,
                showErrorAlert: false,
                showSuccessAlert: false,
                params,
            }));
            return response.data;
        }
        catch (error) {
            if (!isResponseError(error)) {
                throw error;
            }
            if (isCortexErrorResponse(error)) {
                return empty;
            }
            else if (isRulerNotSupported(error)) {
                // assert if the endoint is not supported at all
                throw Object.assign(Object.assign({}, error), { data: Object.assign(Object.assign({}, error.data), { message: RULER_NOT_SUPPORTED_MSG }) });
            }
            throw error;
        }
    });
}
function isResponseError(error) {
    const hasErrorMessage = error.data != null;
    const hasErrorCode = Number.isFinite(error.status);
    return hasErrorCode && hasErrorMessage;
}
function isRulerNotSupported(error) {
    var _a;
    return (error.status === 404 ||
        (error.status === 500 &&
            ((_a = error.data.message) === null || _a === void 0 ? void 0 : _a.includes('unexpected content type from upstream. expected YAML, got text/html'))));
}
function isCortexErrorResponse(error) {
    var _a, _b;
    return (error.status === 404 &&
        (((_a = error.data.message) === null || _a === void 0 ? void 0 : _a.includes('group does not exist')) || ((_b = error.data.message) === null || _b === void 0 ? void 0 : _b.includes('no rule groups found'))));
}
export function deleteNamespace(rulerConfig, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const { path, params } = rulerUrlBuilder(rulerConfig).namespace(namespace);
        yield lastValueFrom(getBackendSrv().fetch({
            method: 'DELETE',
            url: path,
            showErrorAlert: false,
            showSuccessAlert: false,
            params,
        }));
    });
}
//# sourceMappingURL=ruler.js.map