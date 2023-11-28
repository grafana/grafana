import { omit } from 'lodash';
// convert the newer http_config to the older (deprecated) format
export function normalizeFormValues(values) {
    if (!values) {
        return;
    }
    return Object.assign(Object.assign({}, values), { items: values.items.map((item) => {
            var _a, _b;
            return (Object.assign(Object.assign({}, item), { settings: Object.assign(Object.assign({}, item.settings), { http_config: ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.http_config) ? normalizeHTTPConfig((_b = item.settings) === null || _b === void 0 ? void 0 : _b.http_config) : undefined }) }));
        }) });
}
function normalizeHTTPConfig(config) {
    var _a, _b;
    if (isDeprecatedHTTPAuthConfig(config)) {
        return config;
    }
    return Object.assign(Object.assign({}, omit(config, 'authorization')), { bearer_token: (_a = config.authorization) === null || _a === void 0 ? void 0 : _a.credentials, bearer_token_file: (_b = config.authorization) === null || _b === void 0 ? void 0 : _b.credentials_file });
}
function isDeprecatedHTTPAuthConfig(config) {
    return ['bearer_token', 'bearer_token_file'].some((prop) => prop in config);
}
//# sourceMappingURL=util.js.map