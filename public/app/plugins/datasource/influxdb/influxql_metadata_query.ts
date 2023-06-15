import { ScopedVars } from '@grafana/data/src';
import config from 'app/core/config';

import InfluxDatasource from './datasource';
import { buildMetadataQuery } from './influxql_query_builder';
import { replaceHardCodedRetentionPolicy } from './queryUtils';
import { InfluxQuery, InfluxQueryTag, MetadataQueryType } from './types';

type MetadataQueryOptions = {
  type: MetadataQueryType;
  datasource: InfluxDatasource;
  scopedVars?: ScopedVars;
  measurement?: string;
  retentionPolicy?: string;
  tags?: InfluxQueryTag[];
  withKey?: string;
  withMeasurementFilter?: string;
};

const runExploreQuery = async (options: MetadataQueryOptions): Promise<Array<{ text: string }>> => {
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
  const target: InfluxQuery = {
    query,
    rawQuery: true,
    refId: 'metadataQuery',
    policy: replaceHardCodedRetentionPolicy(policy, datasource.retentionPolicies),
  };
  if (config.featureToggles.influxdbBackendMigration) {
    return datasource.runMetadataQuery(target);
  } else {
    const options = { policy: target.policy };
    return datasource.metricFindQuery(query, options);
  }
};

export async function getAllPolicies(datasource: InfluxDatasource): Promise<string[]> {
  const data = await runExploreQuery({ type: 'RETENTION_POLICIES', datasource });
  return data.map((item) => item.text);
}

export async function getAllMeasurementsForTags(
  datasource: InfluxDatasource,
  tags: InfluxQueryTag[],
  withMeasurementFilter?: string
): Promise<string[]> {
  const data = await runExploreQuery({ type: 'MEASUREMENTS', datasource, tags, withMeasurementFilter });
  return data.map((item) => item.text);
}

export async function getTagKeysForMeasurementAndTags(
  datasource: InfluxDatasource,
  tags: InfluxQueryTag[],
  measurement?: string,
  retentionPolicy?: string
): Promise<string[]> {
  const data = await runExploreQuery({ type: 'TAG_KEYS', datasource, measurement, retentionPolicy });
  return data.map((item) => item.text);
}

export async function getTagValues(
  datasource: InfluxDatasource,
  tags: InfluxQueryTag[],
  tagKey: string,
  measurement?: string,
  retentionPolicy?: string
): Promise<string[]> {
  if (tagKey.endsWith('::field')) {
    return [];
  }
  const data = await runExploreQuery({
    type: 'TAG_VALUES',
    withKey: tagKey,
    datasource,
    measurement,
    retentionPolicy,
  });
  return data.map((item) => item.text);
}

export async function getFieldKeysForMeasurement(
  datasource: InfluxDatasource,
  measurement: string,
  retentionPolicy?: string
): Promise<string[]> {
  const data = await runExploreQuery({ type: 'FIELDS', datasource, measurement, retentionPolicy });
  return data.map((item) => item.text);
}
