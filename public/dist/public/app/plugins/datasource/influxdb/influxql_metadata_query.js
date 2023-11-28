import { __awaiter } from "tslib";
import config from 'app/core/config';
import { buildMetadataQuery } from './influxql_query_builder';
const runExploreQuery = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { type, datasource, scopedVars, measurement, retentionPolicy, tags, withKey, withMeasurementFilter } = options;
    const query = buildMetadataQuery({
        type,
        scopedVars,
        measurement,
        retentionPolicy,
        tags,
        withKey,
        withMeasurementFilter,
        templateService: datasource.templateSrv,
        database: datasource.database,
    });
    const policy = retentionPolicy ? datasource.templateSrv.replace(retentionPolicy, {}, 'regex') : '';
    const target = {
        query,
        policy,
        rawQuery: true,
        refId: 'metadataQuery',
    };
    if (config.featureToggles.influxdbBackendMigration) {
        return datasource.runMetadataQuery(target);
    }
    else {
        const options = { policy: target.policy };
        return datasource.metricFindQuery(query, options);
    }
});
export function getAllPolicies(datasource) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield runExploreQuery({ type: 'RETENTION_POLICIES', datasource });
        return data.map((item) => item.text);
    });
}
export function getAllMeasurements(datasource, tags, withMeasurementFilter) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield runExploreQuery({ type: 'MEASUREMENTS', datasource, tags, withMeasurementFilter });
        return data.map((item) => item.text);
    });
}
export function getTagKeys(datasource, measurement, retentionPolicy) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield runExploreQuery({ type: 'TAG_KEYS', datasource, measurement, retentionPolicy });
        return data.map((item) => item.text);
    });
}
export function getTagValues(datasource, tags, withKey, measurement, retentionPolicy) {
    return __awaiter(this, void 0, void 0, function* () {
        if (withKey.endsWith('::field')) {
            return [];
        }
        const data = yield runExploreQuery({
            type: 'TAG_VALUES',
            tags,
            withKey,
            datasource,
            measurement,
            retentionPolicy,
        });
        return data.map((item) => item.text);
    });
}
export function getFieldKeys(datasource, measurement, retentionPolicy) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield runExploreQuery({ type: 'FIELDS', datasource, measurement, retentionPolicy });
        return data.map((item) => item.text);
    });
}
//# sourceMappingURL=influxql_metadata_query.js.map