import { getDataSourceRef } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { store } from 'app/store/store';
import { AppNotificationTimeout } from 'app/types';
import memoizedDebounce from '../memoizedDebounce';
export class CloudWatchRequest {
    constructor(instanceSettings, templateSrv) {
        this.instanceSettings = instanceSettings;
        this.dsQueryEndpoint = '/api/ds/query';
        this.debouncedCustomAlert = memoizedDebounce(displayCustomError, AppNotificationTimeout.Error);
        this.templateSrv = templateSrv;
        this.ref = getDataSourceRef(instanceSettings);
    }
    awsRequest(url, data, headers = {}) {
        const options = {
            method: 'POST',
            url,
            data,
            headers,
        };
        return getBackendSrv().fetch(options);
    }
    convertDimensionFormat(dimensions, scopedVars) {
        return Object.entries(dimensions).reduce((result, [key, value]) => {
            key = this.replaceVariableAndDisplayWarningIfMulti(key, scopedVars, true, 'dimension keys');
            if (Array.isArray(value)) {
                return Object.assign(Object.assign({}, result), { [key]: value });
            }
            if (!value) {
                return Object.assign(Object.assign({}, result), { [key]: null });
            }
            const newValues = this.expandVariableToArray(value, scopedVars);
            return Object.assign(Object.assign({}, result), { [key]: newValues });
        }, {});
    }
    // get the value for a given template variable
    expandVariableToArray(value, scopedVars) {
        const variableName = this.templateSrv.getVariableName(value);
        const valueVar = this.templateSrv.getVariables().find(({ name }) => {
            return name === variableName;
        });
        if (variableName && valueVar) {
            const isMultiVariable = (valueVar === null || valueVar === void 0 ? void 0 : valueVar.type) === 'custom' || (valueVar === null || valueVar === void 0 ? void 0 : valueVar.type) === 'query' || (valueVar === null || valueVar === void 0 ? void 0 : valueVar.type) === 'datasource';
            if (isMultiVariable && valueVar.multi) {
                return this.templateSrv.replace(value, scopedVars, 'pipe').split('|');
            }
            return [this.templateSrv.replace(value, scopedVars)];
        }
        return [value];
    }
    convertMultiFilterFormat(multiFilters, fieldName) {
        return Object.entries(multiFilters).reduce((result, [key, values]) => {
            const interpolatedKey = this.replaceVariableAndDisplayWarningIfMulti(key, {}, true, fieldName);
            if (!values) {
                return Object.assign(Object.assign({}, result), { [interpolatedKey]: null });
            }
            const initialVal = [];
            const newValues = values.reduce((result, value) => {
                const vals = this.expandVariableToArray(value, {});
                return [...result, ...vals];
            }, initialVal);
            return Object.assign(Object.assign({}, result), { [interpolatedKey]: newValues });
        }, {});
    }
    replaceVariableAndDisplayWarningIfMulti(target, scopedVars, displayErrorIfIsMultiTemplateVariable, fieldName) {
        if (displayErrorIfIsMultiTemplateVariable && !!target) {
            const variables = this.templateSrv.getVariables();
            const variable = variables.find(({ name }) => name === this.templateSrv.getVariableName(target));
            const isMultiVariable = (variable === null || variable === void 0 ? void 0 : variable.type) === 'custom' || (variable === null || variable === void 0 ? void 0 : variable.type) === 'query' || (variable === null || variable === void 0 ? void 0 : variable.type) === 'datasource';
            if (isMultiVariable && variable.multi) {
                this.debouncedCustomAlert('CloudWatch templating error', `Multi template variables are not supported for ${fieldName || target}`);
            }
        }
        return this.templateSrv.replace(target, scopedVars);
    }
    getActualRegion(region) {
        var _a;
        if (region === 'default' || region === undefined || region === '') {
            return (_a = this.instanceSettings.jsonData.defaultRegion) !== null && _a !== void 0 ? _a : '';
        }
        return region;
    }
    getVariables() {
        return this.templateSrv.getVariables().map((v) => `$${v.name}`);
    }
}
const displayCustomError = (title, message) => store.dispatch(notifyApp(createErrorNotification(title, message)));
//# sourceMappingURL=CloudWatchRequest.js.map