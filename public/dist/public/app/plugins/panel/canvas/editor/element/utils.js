import { AppEvents } from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { HttpRequestMethod } from '../../panelcfg.gen';
export const callApi = (api, updateLoadingStateCallback) => {
    if (api && api.endpoint) {
        // If API endpoint origin matches Grafana origin, don't call it.
        if (requestMatchesGrafanaOrigin(api.endpoint)) {
            appEvents.emit(AppEvents.alertError, ['Cannot call API at Grafana origin.']);
            updateLoadingStateCallback && updateLoadingStateCallback(false);
            return;
        }
        const request = getRequest(api);
        getBackendSrv()
            .fetch(request)
            .subscribe({
            error: (error) => {
                appEvents.emit(AppEvents.alertError, ['An error has occurred: ', JSON.stringify(error)]);
                updateLoadingStateCallback && updateLoadingStateCallback(false);
            },
            complete: () => {
                appEvents.emit(AppEvents.alertSuccess, ['API call was successful']);
                updateLoadingStateCallback && updateLoadingStateCallback(false);
            },
        });
    }
};
export const interpolateVariables = (text) => {
    var _a;
    const panel = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.panelInEdit;
    return getTemplateSrv().replace(text, panel === null || panel === void 0 ? void 0 : panel.scopedVars);
};
export const getRequest = (api) => {
    var _a;
    const requestHeaders = [];
    const url = new URL(interpolateVariables(api.endpoint));
    let request = {
        url: url.toString(),
        method: api.method,
        data: getData(api),
        headers: requestHeaders,
    };
    if (api.headerParams) {
        api.headerParams.forEach((param) => {
            requestHeaders.push([interpolateVariables(param[0]), interpolateVariables(param[1])]);
        });
    }
    if (api.queryParams) {
        (_a = api.queryParams) === null || _a === void 0 ? void 0 : _a.forEach((param) => {
            url.searchParams.append(interpolateVariables(param[0]), interpolateVariables(param[1]));
        });
        request.url = url.toString();
    }
    if (api.method === HttpRequestMethod.POST) {
        requestHeaders.push(['Content-Type', api.contentType]);
    }
    request.headers = requestHeaders;
    return request;
};
const getData = (api) => {
    let data = api.data ? interpolateVariables(api.data) : '{}';
    if (api.method === HttpRequestMethod.GET) {
        data = undefined;
    }
    return data;
};
const requestMatchesGrafanaOrigin = (requestEndpoint) => {
    const requestURL = new URL(requestEndpoint);
    const grafanaURL = new URL(window.location.origin);
    return requestURL.origin === grafanaURL.origin;
};
//# sourceMappingURL=utils.js.map