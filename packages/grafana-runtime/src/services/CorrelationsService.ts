import {
  DataFrame,
  DataLinkPostProcessor,
  DataLinkTransformationConfig,
  DataSourceInstanceSettings,
  TimeRange,
} from '@grafana/data';

export type CorrelationConfigQuery = {
  field: string;
  target: object; // for queries, this contains anything that would go in the query editor, so any extension off DataQuery a datasource would have, and needs to be generic.
  transformations?: DataLinkTransformationConfig[];
};

export type CorrelationConfigExternal = {
  field: string;
  target: {
    url: string; // For external, this simply contains a URL
  };
  transformations?: DataLinkTransformationConfig[];
};

type CorrelationBase = {
  uid: string;
  sourceUID: string;
  label?: string;
  description?: string;
  provisioned: boolean;
  orgId?: number;
};

export type CorrelationExternal = CorrelationBase & {
  type: 'external';
  config: CorrelationConfigExternal;
};

export type CorrelationQuery = CorrelationBase & {
  type: 'query';
  config: CorrelationConfigQuery;
  targetUID: string;
};

export type CorrelationData =
  | (Omit<CorrelationExternal, 'sourceUID'> & {
      source: DataSourceInstanceSettings;
    })
  | (Omit<CorrelationQuery, 'sourceUID' | 'targetUID'> & {
      source: DataSourceInstanceSettings;
      target: DataSourceInstanceSettings;
    });

export interface CorrelationsData {
  correlations: CorrelationData[];
  page: number;
  limit: number;
  totalCount: number;
}

/**
 * TODO: Write good description
 *
 * @public
 */
export interface CorrelationsService {
  getCorrelationsBySourceUIDs: (sourceUIDs: string[]) => Promise<CorrelationsData>;
  attachCorrelationsToDataFrames: (
    dataFrames: DataFrame[],
    correlations: CorrelationData[],
    dataFrameRefIdToDataSourceUid: Record<string, string>
  ) => DataFrame[];
  correlationsDataLinkPostProcessorFactory: (timeRange: TimeRange) => DataLinkPostProcessor;
}

let singletonInstance: CorrelationsService;

/**
 * Used during startup by Grafana to set the CorrelationsService so it is available
 * via {@link getCorrelationsService} to the rest of the application.
 *
 * @internal
 */
export function setCorrelationsService(instance: CorrelationsService) {
  console.log('setCorrelationsService', instance);
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link CorrelationsService}.
 *
 * @public
 */
export function getCorrelationsService(): CorrelationsService {
  return singletonInstance;
}
