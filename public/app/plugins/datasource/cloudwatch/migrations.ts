import { AnnotationQuery, DataQuery } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';

import {
  CloudWatchMetricsQuery,
  LegacyAnnotationQuery,
  MetricEditorMode,
  MetricQueryType,
  VariableQuery,
  VariableQueryType,
} from './types';

// Migrates a metric query that use more than one statistic into multiple queries
// E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
export function migrateMultipleStatsMetricsQuery(
  query: CloudWatchMetricsQuery,
  panelQueries: DataQuery[]
): DataQuery[] {
  const newQueries = [];
  if (query?.statistics && query?.statistics.length) {
    query.statistic = query.statistics[0];
    for (const stat of query.statistics.splice(1)) {
      newQueries.push({ ...query, statistic: stat });
    }
  }
  for (const newTarget of newQueries) {
    newTarget.refId = getNextRefIdChar(panelQueries);
    delete newTarget.statistics;
    panelQueries.push(newTarget);
  }
  delete query.statistics;

  return newQueries;
}

// Migrates an annotation query that use more than one statistic into multiple queries
// E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
export function migrateMultipleStatsAnnotationQuery(
  annotationQuery: AnnotationQuery<LegacyAnnotationQuery>
): Array<AnnotationQuery<DataQuery>> {
  const newAnnotations: Array<AnnotationQuery<LegacyAnnotationQuery>> = [];

  if (annotationQuery && 'statistics' in annotationQuery && annotationQuery?.statistics?.length) {
    for (const stat of annotationQuery.statistics.splice(1)) {
      const { statistics, name, ...newAnnotation } = annotationQuery;
      newAnnotations.push({ ...newAnnotation, statistic: stat, name: `${name} - ${stat}` });
    }
    annotationQuery.statistic = annotationQuery.statistics[0];
    // Only change the name of the original if new annotations have been created
    if (newAnnotations.length !== 0) {
      annotationQuery.name = `${annotationQuery.name} - ${annotationQuery.statistic}`;
    }
    delete annotationQuery.statistics;
  }

  return newAnnotations;
}

export function migrateCloudWatchQuery(query: CloudWatchMetricsQuery) {
  if (!query.hasOwnProperty('metricQueryType')) {
    query.metricQueryType = MetricQueryType.Search;
  }

  if (!query.hasOwnProperty('metricEditorMode')) {
    if (query.metricQueryType === MetricQueryType.Query) {
      query.metricEditorMode = MetricEditorMode.Code;
    } else {
      query.metricEditorMode = query.expression ? MetricEditorMode.Code : MetricEditorMode.Builder;
    }
  }
}

export function migrateVariableQuery(rawQuery: string | VariableQuery): VariableQuery {
  if (typeof rawQuery !== 'string') {
    return rawQuery;
  }
  const newQuery: VariableQuery = {
    refId: 'CloudWatchVariableQueryEditor-VariableQuery',
    queryType: VariableQueryType.Regions,
    namespace: '',
    region: '',
    metricName: '',
    dimensionKey: '',
    dimensionFilters: {},
    ec2Filters: '',
    instanceID: '',
    attributeName: '',
    resourceType: '',
    tags: '',
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

  const dimensionValuesQuery = rawQuery.match(
    /^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/
  );
  if (dimensionValuesQuery) {
    newQuery.queryType = VariableQueryType.DimensionValues;
    newQuery.region = dimensionValuesQuery[1];
    newQuery.namespace = dimensionValuesQuery[2];
    newQuery.metricName = dimensionValuesQuery[3];
    newQuery.dimensionKey = dimensionValuesQuery[4];
    newQuery.dimensionFilters = {};
    if (!!dimensionValuesQuery[6]) {
      try {
        newQuery.dimensionFilters = JSON.parse(dimensionValuesQuery[6]);
      } catch {
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
    newQuery.ec2Filters = ec2InstanceAttributeQuery[3] || '';
    return newQuery;
  }

  const resourceARNsQuery = rawQuery.match(/^resource_arns\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
  if (resourceARNsQuery) {
    newQuery.queryType = VariableQueryType.ResourceArns;
    newQuery.region = resourceARNsQuery[1];
    newQuery.resourceType = resourceARNsQuery[2];
    newQuery.tags = resourceARNsQuery[3] || '';
    return newQuery;
  }

  const statsQuery = rawQuery.match(/^statistics\(\)/);
  if (statsQuery) {
    newQuery.queryType = VariableQueryType.Statistics;
    return newQuery;
  }
  throw new Error('unable to parse old variable query');
}
