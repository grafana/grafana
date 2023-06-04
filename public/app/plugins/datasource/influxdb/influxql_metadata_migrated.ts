import { ScopedVars } from '@grafana/data/src';

import InfluxDatasource from './datasource';
import { buildMetadataQuery } from './influx_query_builder_migrated';
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

export const runMetadataQuery = async (options: MetadataQueryOptions): Promise<Array<{ text: string }>> => {
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
  return datasource.runMetadataQuery(target);
};

export async function getAllPolicies(datasource: InfluxDatasource): Promise<string[]> {
  const data = await runMetadataQuery({ type: 'RETENTION_POLICIES', datasource });
  return data.map((item) => item.text);
}

export async function getAllMeasurementsForTags(
  datasource: InfluxDatasource,
  tags: InfluxQueryTag[],
  withMeasurementFilter?: string
): Promise<string[]> {
  const data = await runMetadataQuery({ type: 'MEASUREMENTS', datasource, tags, withMeasurementFilter });
  return data.map((item) => item.text);
}

export async function getTagKeysForMeasurementAndTags(
  datasource: InfluxDatasource,
  tags: InfluxQueryTag[],
  measurement?: string,
  retentionPolicy?: string
): Promise<string[]> {
  const data = await runMetadataQuery({ type: 'TAG_KEYS', datasource, measurement, retentionPolicy });
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
  const data = await runMetadataQuery({
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
  const data = await runMetadataQuery({ type: 'FIELDS', datasource, measurement, retentionPolicy });
  return data.map((item) => item.text);
}
