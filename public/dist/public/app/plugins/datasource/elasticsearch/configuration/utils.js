import { defaultMaxConcurrentShardRequests } from './ElasticDetails';
export const coerceOptions = (options) => {
    var _a;
    return Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { timeField: options.jsonData.timeField || '@timestamp', maxConcurrentShardRequests: options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(), logMessageField: options.jsonData.logMessageField || '', logLevelField: options.jsonData.logLevelField || '', includeFrozen: (_a = options.jsonData.includeFrozen) !== null && _a !== void 0 ? _a : false }) });
};
export const isValidOptions = (options) => {
    return (
    // timeField should not be empty or nullish
    !!options.jsonData.timeField &&
        // maxConcurrentShardRequests should be a number AND greater than 0
        !!options.jsonData.maxConcurrentShardRequests &&
        // message & level fields should be defined
        options.jsonData.logMessageField !== undefined &&
        options.jsonData.logLevelField !== undefined);
};
//# sourceMappingURL=utils.js.map