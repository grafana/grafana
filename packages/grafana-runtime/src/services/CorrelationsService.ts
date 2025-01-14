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

/**
 * @alpha
 */
export type CorrelationExternal = CorrelationBase & {
  type: 'external';
  config: CorrelationConfigExternal;
};

/**
 * @alpha
 */
export type CorrelationQuery = CorrelationBase & {
  type: 'query';
  config: CorrelationConfigQuery;
  targetUID: string;
};

/**
 * @alpha
 */
export type CorrelationData =
  | (Omit<CorrelationExternal, 'sourceUID'> & {
      source: DataSourceInstanceSettings;
    })
  | (Omit<CorrelationQuery, 'sourceUID' | 'targetUID'> & {
      source: DataSourceInstanceSettings;
      target: DataSourceInstanceSettings;
    });

/**
 * @alpha
 */
export interface CorrelationsData {
  correlations: CorrelationData[];
  page: number;
  limit: number;
  totalCount: number;
}

/**
 * Used to work with user defined correlations.
 * Should be accessed via {@link getCorrelationsService} function.
 *
 * @alpha
 */
export interface CorrelationsService {
  /**
   * Creates data links in data frames from provided correlations
   *
   * @param dataFrames list of data frames to be processed
   * @param correlations list of of possible correlations that can be applied
   * @param dataFrameRefIdToDataSourceUid a map that for provided refId references corresponding data source ui
   */
  attachCorrelationsToDataFrames: (
    dataFrames: DataFrame[],
    correlations: CorrelationData[],
    dataFrameRefIdToDataSourceUid: Record<string, string>
  ) => DataFrame[];

  /**
   * Creates a link post processor function that handles correlation transformations
   *
   * @param timeRange The current time range
   */
  correlationsDataLinkPostProcessorFactory: (timeRange: TimeRange) => DataLinkPostProcessor;

  /**
   * Loads all the correlations defined for the given data sources.
   *
   * @param sourceUIDs Data source UIDs
   */
  getCorrelationsBySourceUIDs: (sourceUIDs: string[]) => Promise<CorrelationsData>;
}

let singletonInstance: CorrelationsService;

/**
 * Used during startup by Grafana to set the CorrelationsService so it is available
 * via {@link getCorrelationsService} to the rest of the application.
 *
 * @internal
 */
export function setCorrelationsService(instance: CorrelationsService) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link CorrelationsService}.
 *
 * @alpha
 */
export function getCorrelationsService(): CorrelationsService {
  return singletonInstance;
}
