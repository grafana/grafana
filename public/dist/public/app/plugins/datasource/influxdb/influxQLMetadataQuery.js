import { __awaiter, __generator } from "tslib";
import { InfluxQueryBuilder } from './query_builder';
var runExploreQuery = function (type, withKey, withMeasurementFilter, target, datasource) {
    var builder = new InfluxQueryBuilder(target, datasource.database);
    var q = builder.buildExploreQuery(type, withKey, withMeasurementFilter);
    return datasource.metricFindQuery(q);
};
export function getAllPolicies(datasource) {
    return __awaiter(this, void 0, void 0, function () {
        var target, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    target = { tags: [], measurement: undefined, policy: undefined };
                    return [4 /*yield*/, runExploreQuery('RETENTION POLICIES', undefined, undefined, target, datasource)];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, data.map(function (item) { return item.text; })];
            }
        });
    });
}
export function getAllMeasurementsForTags(measurementFilter, tags, datasource) {
    return __awaiter(this, void 0, void 0, function () {
        var target, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    target = { tags: tags, measurement: undefined, policy: undefined };
                    return [4 /*yield*/, runExploreQuery('MEASUREMENTS', undefined, measurementFilter, target, datasource)];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, data.map(function (item) { return item.text; })];
            }
        });
    });
}
export function getTagKeysForMeasurementAndTags(measurement, policy, tags, datasource) {
    return __awaiter(this, void 0, void 0, function () {
        var target, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    target = { tags: tags, measurement: measurement, policy: policy };
                    return [4 /*yield*/, runExploreQuery('TAG_KEYS', undefined, undefined, target, datasource)];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, data.map(function (item) { return item.text; })];
            }
        });
    });
}
export function getTagValues(tagKey, measurement, policy, tags, datasource) {
    return __awaiter(this, void 0, void 0, function () {
        var target, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    target = { tags: tags, measurement: measurement, policy: policy };
                    return [4 /*yield*/, runExploreQuery('TAG_VALUES', tagKey, undefined, target, datasource)];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, data.map(function (item) { return item.text; })];
            }
        });
    });
}
export function getFieldKeysForMeasurement(measurement, policy, datasource) {
    return __awaiter(this, void 0, void 0, function () {
        var target, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    target = { tags: [], measurement: measurement, policy: policy };
                    return [4 /*yield*/, runExploreQuery('FIELDS', undefined, undefined, target, datasource)];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, data.map(function (item) { return item.text; })];
            }
        });
    });
}
//# sourceMappingURL=influxQLMetadataQuery.js.map