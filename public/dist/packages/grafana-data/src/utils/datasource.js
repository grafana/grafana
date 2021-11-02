import { __assign } from "tslib";
import { isString } from 'lodash';
/**
 * Convert instance settings to a reference
 *
 * @public
 */
export function getDataSourceRef(ds) {
    return { uid: ds.uid, type: ds.type };
}
function isDataSourceRef(ref) {
    return typeof ref === 'object' && (typeof (ref === null || ref === void 0 ? void 0 : ref.uid) === 'string' || typeof (ref === null || ref === void 0 ? void 0 : ref.uid) === 'undefined');
}
/**
 * Get the UID from a string of reference
 *
 * @public
 */
export function getDataSourceUID(ref) {
    if (isDataSourceRef(ref)) {
        return ref.uid;
    }
    if (isString(ref)) {
        return ref;
    }
    return undefined;
}
export var onUpdateDatasourceOption = function (props, key) { return function (event) {
    updateDatasourcePluginOption(props, key, event.currentTarget.value);
}; };
export var onUpdateDatasourceJsonDataOption = function (props, key) { return function (event) {
    updateDatasourcePluginJsonDataOption(props, key, event.currentTarget.value);
}; };
export var onUpdateDatasourceSecureJsonDataOption = function (props, key) { return function (event) {
    updateDatasourcePluginSecureJsonDataOption(props, key, event.currentTarget.value);
}; };
export var onUpdateDatasourceJsonDataOptionSelect = function (props, key) { return function (selected) {
    updateDatasourcePluginJsonDataOption(props, key, selected.value);
}; };
export var onUpdateDatasourceJsonDataOptionChecked = function (props, key) { return function (event) {
    updateDatasourcePluginJsonDataOption(props, key, event.currentTarget.checked);
}; };
export var onUpdateDatasourceSecureJsonDataOptionSelect = function (props, key) { return function (selected) {
    updateDatasourcePluginSecureJsonDataOption(props, key, selected.value);
}; };
export var onUpdateDatasourceResetOption = function (props, key) { return function (event) {
    updateDatasourcePluginResetOption(props, key);
}; };
export function updateDatasourcePluginOption(props, key, val) {
    var _a;
    var config = props.options;
    props.onOptionsChange(__assign(__assign({}, config), (_a = {}, _a[key] = val, _a)));
}
export var updateDatasourcePluginJsonDataOption = function (props, key, val) {
    var _a;
    var config = props.options;
    props.onOptionsChange(__assign(__assign({}, config), { jsonData: __assign(__assign({}, config.jsonData), (_a = {}, _a[key] = val, _a)) }));
};
export var updateDatasourcePluginSecureJsonDataOption = function (props, key, val) {
    var _a;
    var config = props.options;
    if (!config.secureJsonData) {
        return;
    }
    props.onOptionsChange(__assign(__assign({}, config), { secureJsonData: __assign(__assign({}, config.secureJsonData), (_a = {}, _a[key] = val, _a)) }));
};
export var updateDatasourcePluginResetOption = function (props, key) {
    var _a, _b;
    var config = props.options;
    if (!config.secureJsonData) {
        return;
    }
    props.onOptionsChange(__assign(__assign({}, config), { secureJsonData: __assign(__assign({}, config.secureJsonData), (_a = {}, _a[key] = '', _a)), secureJsonFields: __assign(__assign({}, config.secureJsonFields), (_b = {}, _b[key] = false, _b)) }));
};
//# sourceMappingURL=datasource.js.map