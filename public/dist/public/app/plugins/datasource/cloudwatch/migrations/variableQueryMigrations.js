import { omit } from 'lodash';
import { VariableQueryType } from '../types';
const jsonVariable = /\${(\w+):json}/g;
function isVariableQuery(rawQuery) {
    return typeof rawQuery !== 'string' && typeof rawQuery.ec2Filters !== 'string' && typeof rawQuery.tags !== 'string';
}
function migrateMultiFilters(oldFilters) {
    const tempFilters = oldFilters.replace(jsonVariable, '"$$$1"');
    const parsedFilters = JSON.parse(tempFilters);
    const newFilters = {};
    // if the old filter was {key:value} transform it to {key:[value]}
    Object.keys(parsedFilters).forEach((key) => {
        const value = parsedFilters[key];
        if (typeof value === 'string') {
            newFilters[key] = [value];
        }
        else if (value !== undefined) {
            newFilters[key] = value;
        }
    });
    return newFilters;
}
export function migrateVariableQuery(rawQuery) {
    if (isVariableQuery(rawQuery)) {
        return rawQuery;
    }
    // rawQuery is OldVariableQuery
    if (typeof rawQuery !== 'string') {
        const newQuery = omit(rawQuery, ['dimensionFilters', 'ec2Filters', 'tags']);
        newQuery.dimensionFilters = {};
        newQuery.ec2Filters = {};
        newQuery.tags = {};
        if (rawQuery.dimensionFilters !== '' && rawQuery.ec2Filters !== '[]') {
            const tempFilters = rawQuery.dimensionFilters.replace(jsonVariable, '"$$$1"');
            try {
                newQuery.dimensionFilters = JSON.parse(tempFilters);
            }
            catch (_a) {
                throw new Error(`unable to migrate poorly formed filters: ${rawQuery.dimensionFilters}`);
            }
        }
        if (rawQuery.ec2Filters !== '' && rawQuery.ec2Filters !== '[]') {
            try {
                newQuery.ec2Filters = migrateMultiFilters(rawQuery.ec2Filters);
            }
            catch (_b) {
                throw new Error(`unable to migrate poorly formed filters: ${rawQuery.ec2Filters}`);
            }
        }
        if (rawQuery.tags !== '' && rawQuery.tags !== '[]') {
            try {
                newQuery.tags = migrateMultiFilters(rawQuery.tags);
            }
            catch (_c) {
                throw new Error(`unable to migrate poorly formed filters: ${rawQuery.tags}`);
            }
        }
        return newQuery;
    }
    const newQuery = {
        refId: 'CloudWatchVariableQueryEditor-VariableQuery',
        queryType: VariableQueryType.Regions,
        namespace: '',
        region: '',
        metricName: '',
        dimensionKey: '',
        dimensionFilters: {},
        ec2Filters: {},
        instanceID: '',
        attributeName: '',
        resourceType: '',
        tags: {},
    };
    if (rawQuery === '') {
        return newQuery;
    }
    if (rawQuery.match(/^regions\(\)/)) {
        return newQuery;
    }
    if (rawQuery.match(/^namespaces\(\)/)) {
        newQuery.queryType = VariableQueryType.Namespaces;
        return newQuery;
    }
    const metricNameQuery = rawQuery.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (metricNameQuery) {
        newQuery.queryType = VariableQueryType.Metrics;
        newQuery.namespace = metricNameQuery[1];
        newQuery.region = metricNameQuery[3] || '';
        return newQuery;
    }
    const dimensionKeysQuery = rawQuery.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (dimensionKeysQuery) {
        newQuery.queryType = VariableQueryType.DimensionKeys;
        newQuery.namespace = dimensionKeysQuery[1];
        newQuery.region = dimensionKeysQuery[3] || '';
        return newQuery;
    }
    const dimensionValuesQuery = rawQuery.match(/^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/);
    if (dimensionValuesQuery) {
        newQuery.queryType = VariableQueryType.DimensionValues;
        newQuery.region = dimensionValuesQuery[1];
        newQuery.namespace = dimensionValuesQuery[2];
        newQuery.metricName = dimensionValuesQuery[3];
        newQuery.dimensionKey = dimensionValuesQuery[4];
        newQuery.dimensionFilters = {};
        if (!!dimensionValuesQuery[6] && dimensionValuesQuery[6] !== '[]') {
            const tempFilters = dimensionValuesQuery[6].replace(jsonVariable, '"$$$1"');
            try {
                newQuery.dimensionFilters = JSON.parse(tempFilters);
            }
            catch (_d) {
                throw new Error(`unable to migrate poorly formed filters: ${dimensionValuesQuery[6]}`);
            }
        }
        return newQuery;
    }
    const ebsVolumeIdsQuery = rawQuery.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
    if (ebsVolumeIdsQuery) {
        newQuery.queryType = VariableQueryType.EBSVolumeIDs;
        newQuery.region = ebsVolumeIdsQuery[1];
        newQuery.instanceID = ebsVolumeIdsQuery[2];
        return newQuery;
    }
    const ec2InstanceAttributeQuery = rawQuery.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
    if (ec2InstanceAttributeQuery) {
        newQuery.queryType = VariableQueryType.EC2InstanceAttributes;
        newQuery.region = ec2InstanceAttributeQuery[1];
        newQuery.attributeName = ec2InstanceAttributeQuery[2];
        if (ec2InstanceAttributeQuery[3] && ec2InstanceAttributeQuery[3] !== '[]') {
            try {
                newQuery.ec2Filters = migrateMultiFilters(ec2InstanceAttributeQuery[3]);
            }
            catch (_e) {
                throw new Error(`unable to migrate poorly formed filters: ${ec2InstanceAttributeQuery[3]}`);
            }
        }
        return newQuery;
    }
    const resourceARNsQuery = rawQuery.match(/^resource_arns\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
    if (resourceARNsQuery) {
        newQuery.queryType = VariableQueryType.ResourceArns;
        newQuery.region = resourceARNsQuery[1];
        newQuery.resourceType = resourceARNsQuery[2];
        if (resourceARNsQuery[3] && resourceARNsQuery[3] !== '[]') {
            try {
                newQuery.tags = migrateMultiFilters(resourceARNsQuery[3]);
            }
            catch (_f) {
                throw new Error(`unable to migrate poorly formed filters: ${resourceARNsQuery[3]}`);
            }
        }
        return newQuery;
    }
    const statsQuery = rawQuery.match(/^statistics\(\)/);
    if (statsQuery) {
        newQuery.queryType = VariableQueryType.Statistics;
        return newQuery;
    }
    throw new Error('unable to parse old variable query');
}
//# sourceMappingURL=variableQueryMigrations.js.map