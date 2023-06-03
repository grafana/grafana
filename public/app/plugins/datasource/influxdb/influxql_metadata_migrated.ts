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
  const query = buildMetadataQuery(
    type,
    datasource.templateSrv,
    scopedVars,
    datasource.database,
    measurement,
    retentionPolicy,
    tags,
    withKey,
    withMeasurementFilter
  );
  const policy = retentionPolicy ? datasource.templateSrv.replace(retentionPolicy, {}, 'regex') : '';
  const target: InfluxQuery = {
    query,
    rawQuery: true,
    refId: 'metadataQuery',
    policy: replaceHardCodedRetentionPolicy(policy, datasource.retentionPolicies),
  };
  return datasource.runMetadataQuery(target);
};
