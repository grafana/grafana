import { DataFrame, DataQuery } from '@grafana/data';

import { CorrelationData } from './useCorrelations';

type QueryToDS = Record<string, string>;

export const mapQueryRefIdToDataSourceUid = (queries: DataQuery[]): QueryToDS => {
  let queryRefIdToDataSourceUid: QueryToDS = {};
  queries!.forEach((query: DataQuery) => {
    if (query.datasource && query.datasource.uid) {
      queryRefIdToDataSourceUid[query.refId] = query.datasource.uid;
    }
  });
  return queryRefIdToDataSourceUid;
};

export const decorateDataFrameWithInternalDataLinks = (dataFrame: DataFrame, correlations: CorrelationData[]) => {
  dataFrame.fields.forEach((field) => {
    correlations.map((correlation) => {
      if (correlation.config?.field === field.name) {
        field.config.links = field.config.links || [];
        field.config.links.push({
          internal: {
            query: correlation.config?.target,
            datasourceUid: correlation.target.uid,
            datasourceName: correlation.target.name,
          },
          url: '',
          title: correlation.target.name,
        });
      }
    });
  });
};

export type CorrelationsByDataSourceUid = {
  [uid: string]: CorrelationData[];
};

export const groupCorrelationsByDataSourceUid = (correlations: CorrelationData[]): CorrelationsByDataSourceUid => {
  const correlationsByDataSourceUid: CorrelationsByDataSourceUid = {};
  correlations.forEach((c) => {
    correlationsByDataSourceUid[c.source.uid] = correlationsByDataSourceUid[c.source.uid] || [];
    correlationsByDataSourceUid[c.source.uid].push(c);
  });
  return correlationsByDataSourceUid;
};
