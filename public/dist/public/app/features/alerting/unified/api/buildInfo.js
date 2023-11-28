import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { PromApplication, } from 'app/types/unified-alerting-dto';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
import { getDataSourceByName, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { fetchRules } from './prometheus';
import { fetchTestRulerRulesGroup } from './ruler';
/**
 * Attempt to fetch buildinfo from our component
 */
export function discoverFeatures(dataSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
            return {
                features: {
                    rulerApiEnabled: true,
                },
            };
        }
        const dsConfig = getDataSourceByName(dataSourceName);
        if (!dsConfig) {
            throw new Error(`Cannot find data source configuration for ${dataSourceName}`);
        }
        const { url, name, type } = dsConfig;
        if (!url) {
            throw new Error(`The data source url cannot be empty.`);
        }
        if (type !== 'prometheus' && type !== 'loki') {
            throw new Error(`The build info request is not available for ${type}. Only 'prometheus' and 'loki' are supported`);
        }
        return discoverDataSourceFeatures({ name, url, type });
    });
}
/**
 * This function will attempt to detect what type of system we are talking to; this could be
 * Prometheus (vanilla) | Cortex | Mimir
 *
 * Cortex and Mimir allow editing rules via their API, Prometheus does not.
 * Prometheus and Mimir expose a `buildinfo` endpoint, Cortex does not.
 * Mimir reports which "features" are enabled or available via the buildinfo endpoint, Prometheus does not.
 */
export function discoverDataSourceFeatures(dsSettings) {
    return __awaiter(this, void 0, void 0, function* () {
        const { url, name, type } = dsSettings;
        // The current implementation of Loki's build info endpoint is useless
        // because it doesn't provide information about Loki's available features (e.g. Ruler API)
        // It's better to skip fetching it for Loki and go the Cortex path (manual discovery)
        const buildInfoResponse = type === 'loki' ? undefined : yield fetchPromBuildInfo(url);
        // check if the component returns buildinfo
        const hasBuildInfo = buildInfoResponse !== undefined;
        // we are dealing with a Cortex or Loki datasource since the response for buildinfo came up empty
        if (!hasBuildInfo) {
            // check if we can fetch rules via the prometheus compatible api
            const promRulesSupported = yield hasPromRulesSupport(name);
            if (!promRulesSupported) {
                throw new Error(`Unable to fetch alert rules. Is the ${name} data source properly configured?`);
            }
            // check if the ruler is enabled
            const rulerSupported = yield hasRulerSupport(name);
            return {
                application: PromApplication.Cortex,
                features: {
                    rulerApiEnabled: rulerSupported,
                },
            };
        }
        // if no features are reported but buildinfo was returned we're talking to Prometheus
        const { features } = buildInfoResponse.data;
        if (!features) {
            return {
                application: PromApplication.Prometheus,
                features: {
                    rulerApiEnabled: false,
                },
            };
        }
        // if we have both features and buildinfo reported we're talking to Mimir
        return {
            application: PromApplication.Mimir,
            features: {
                rulerApiEnabled: (features === null || features === void 0 ? void 0 : features.ruler_config_api) === 'true',
            },
        };
    });
}
export function discoverAlertmanagerFeatures(amSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (amSourceName === GRAFANA_RULES_SOURCE_NAME) {
            return { lazyConfigInit: false };
        }
        const dsConfig = getDataSourceConfig(amSourceName);
        const { url, type } = dsConfig;
        if (!url) {
            throw new Error(`The data source url cannot be empty.`);
        }
        if (type !== 'alertmanager') {
            throw new Error(`Alertmanager feature discovery is not available for ${type}. Only 'alertmanager' type is supported`);
        }
        return yield discoverAlertmanagerFeaturesByUrl(url);
    });
}
export function discoverAlertmanagerFeaturesByUrl(url) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const buildInfo = yield fetchPromBuildInfo(url);
            return { lazyConfigInit: ((_a = buildInfo === null || buildInfo === void 0 ? void 0 : buildInfo.data) === null || _a === void 0 ? void 0 : _a.application) === 'Grafana Mimir' };
        }
        catch (e) {
            // If we cannot access the build info then we assume the lazy config is not available
            return { lazyConfigInit: false };
        }
    });
}
function getDataSourceConfig(amSourceName) {
    const dsConfig = getDataSourceByName(amSourceName);
    if (!dsConfig) {
        throw new Error(`Cannot find data source configuration for ${amSourceName}`);
    }
    return dsConfig;
}
export function fetchPromBuildInfo(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield lastValueFrom(getBackendSrv().fetch({
            url: `${url}/api/v1/status/buildinfo`,
            showErrorAlert: false,
            showSuccessAlert: false,
        })).catch((e) => {
            if ('status' in e && e.status === 404) {
                return undefined; // Cortex does not support buildinfo endpoint, we return an empty response
            }
            throw e;
        });
        return response === null || response === void 0 ? void 0 : response.data;
    });
}
/**
 * Check if the component allows us to fetch rules
 */
function hasPromRulesSupport(dataSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fetchRules(dataSourceName);
            return true;
        }
        catch (e) {
            return false;
        }
    });
}
/**
 * Attempt to check if the ruler API is enabled for Cortex, Prometheus does not support it and Mimir
 * reports this via the buildInfo "features"
 */
function hasRulerSupport(dataSourceName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fetchTestRulerRulesGroup(dataSourceName);
            return true;
        }
        catch (e) {
            if (errorIndicatesMissingRulerSupport(e)) {
                return false;
            }
            throw e;
        }
    });
}
// there errors indicate that the ruler API might be disabled or not supported for Cortex
function errorIndicatesMissingRulerSupport(error) {
    var _a, _b, _c, _d;
    return isFetchError(error)
        ? ((_a = error.data.message) === null || _a === void 0 ? void 0 : _a.includes('GetRuleGroup unsupported in rule local store')) || // "local" rule storage
            ((_b = error.data.message) === null || _b === void 0 ? void 0 : _b.includes('page not found')) || // ruler api disabled
            ((_c = error.data.message) === null || _c === void 0 ? void 0 : _c.includes(RULER_NOT_SUPPORTED_MSG)) // ruler api not supported
        : error instanceof Error && ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('404 from rules config endpoint')); // ruler api disabled
}
//# sourceMappingURL=buildInfo.js.map