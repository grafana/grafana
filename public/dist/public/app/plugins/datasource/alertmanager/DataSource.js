import { __awaiter } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { DataSourceApi } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { discoverAlertmanagerFeaturesByUrl } from '../../../features/alerting/unified/api/buildInfo';
import { messageFromError } from '../../../features/alerting/unified/utils/redux';
import { AlertManagerImplementation } from './types';
export class AlertManagerDatasource extends DataSourceApi {
    constructor(instanceSettings) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
    }
    // `query()` has to be implemented but we actually don't use it, just need this
    // data source to proxy requests.
    // @ts-ignore
    query() {
        return of({
            data: [],
        });
    }
    _request(url) {
        const options = {
            headers: {},
            method: 'GET',
            url: this.instanceSettings.url + url,
        };
        if (this.instanceSettings.basicAuth || this.instanceSettings.withCredentials) {
            this.instanceSettings.withCredentials = true;
        }
        if (this.instanceSettings.basicAuth) {
            options.headers.Authorization = this.instanceSettings.basicAuth;
        }
        return lastValueFrom(getBackendSrv().fetch(options));
    }
    testDatasource() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let alertmanagerResponse;
            const amUrl = this.instanceSettings.url;
            const amFeatures = amUrl
                ? yield discoverAlertmanagerFeaturesByUrl(amUrl)
                : { lazyConfigInit: false };
            if (this.instanceSettings.jsonData.implementation === AlertManagerImplementation.prometheus) {
                try {
                    alertmanagerResponse = yield this._request('/alertmanager/api/v2/status');
                    if (alertmanagerResponse && (alertmanagerResponse === null || alertmanagerResponse === void 0 ? void 0 : alertmanagerResponse.status) === 200) {
                        return {
                            status: 'error',
                            message: 'It looks like you have chosen Prometheus implementation, but detected a Mimir or Cortex endpoint. Please update implementation selection and try again.',
                        };
                    }
                }
                catch (e) { }
                try {
                    alertmanagerResponse = yield this._request('/api/v2/status');
                }
                catch (e) { }
            }
            else {
                try {
                    alertmanagerResponse = yield this._request('/api/v2/status');
                    if (alertmanagerResponse && (alertmanagerResponse === null || alertmanagerResponse === void 0 ? void 0 : alertmanagerResponse.status) === 200) {
                        return {
                            status: 'error',
                            message: 'It looks like you have chosen a Mimir or Cortex implementation, but detected a Prometheus endpoint. Please update implementation selection and try again.',
                        };
                    }
                }
                catch (e) { }
                try {
                    alertmanagerResponse = yield this._request('/alertmanager/api/v2/status');
                }
                catch (e) {
                    if (isFetchError(e) &&
                        amFeatures.lazyConfigInit &&
                        ((_a = messageFromError(e)) === null || _a === void 0 ? void 0 : _a.includes('the Alertmanager is not configured'))) {
                        return {
                            status: 'success',
                            message: 'Health check passed.',
                            details: { message: 'Mimir Alertmanager without the fallback configuration has been discovered.' },
                        };
                    }
                }
            }
            return (alertmanagerResponse === null || alertmanagerResponse === void 0 ? void 0 : alertmanagerResponse.status) === 200
                ? {
                    status: 'success',
                    message: 'Health check passed.',
                }
                : {
                    status: 'error',
                    message: 'Health check failed.',
                };
        });
    }
}
//# sourceMappingURL=DataSource.js.map