import { __assign } from "tslib";
import { valid } from 'semver';
import { coerceESVersion } from '../utils';
import { defaultMaxConcurrentShardRequests } from './ElasticDetails';
export var coerceOptions = function (options) {
    var _a;
    var esVersion = coerceESVersion(options.jsonData.esVersion);
    return __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { timeField: options.jsonData.timeField || '@timestamp', esVersion: esVersion, maxConcurrentShardRequests: options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(esVersion), logMessageField: options.jsonData.logMessageField || '', logLevelField: options.jsonData.logLevelField || '', includeFrozen: (_a = options.jsonData.includeFrozen) !== null && _a !== void 0 ? _a : false }) });
};
export var isValidOptions = function (options) {
    return (
    // esVersion should be a valid semver string
    !!valid(options.jsonData.esVersion) &&
        // timeField should not be empty or nullish
        !!options.jsonData.timeField &&
        // maxConcurrentShardRequests should be a number AND greater than 0
        !!options.jsonData.maxConcurrentShardRequests &&
        // message & level fields should be defined
        options.jsonData.logMessageField !== undefined &&
        options.jsonData.logLevelField !== undefined);
};
//# sourceMappingURL=utils.js.map