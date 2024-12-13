import { getDataSourceSrv } from '../services/dataSourceSrv';
import { createMonitoringLogger } from '../utils/logging';

import { Correlation, CorrelationData, CorrelationsData, CorrelationsResponse } from './types';

const correlationsLogger = createMonitoringLogger('features.correlations');

export const toEnrichedCorrelationData = ({ sourceUID, ...correlation }: Correlation): CorrelationData | undefined => {
  const sourceDatasource = getDataSourceSrv().getInstanceSettings(sourceUID);
  const targetDatasource =
    correlation.type === 'query' ? getDataSourceSrv().getInstanceSettings(correlation.targetUID) : undefined;

  // According to #72258 we will remove logic to handle orgId=0/null as global correlations.
  // This logging is to check if there are any customers who did not migrate existing correlations.
  // See Deprecation Notice in https://github.com/grafana/grafana/pull/72258 for more details
  if (correlation?.orgId === undefined || correlation?.orgId === null || correlation?.orgId === 0) {
    correlationsLogger.logWarning('Invalid correlation config: Missing org id.');
  }

  if (
    sourceDatasource &&
    sourceDatasource?.uid !== undefined &&
    targetDatasource?.uid !== undefined &&
    correlation.type === 'query'
  ) {
    return {
      ...correlation,
      source: sourceDatasource,
      target: targetDatasource,
    };
  }

  if (
    sourceDatasource &&
    sourceDatasource?.uid !== undefined &&
    targetDatasource?.uid === undefined &&
    correlation.type === 'external'
  ) {
    return {
      ...correlation,
      source: sourceDatasource,
    };
  }

  correlationsLogger.logWarning(`Invalid correlation config: Missing source or target.`, {
    source: JSON.stringify(sourceDatasource),
    target: JSON.stringify(targetDatasource),
  });
  return undefined;
};

const validSourceFilter = (correlation: CorrelationData | undefined): correlation is CorrelationData => !!correlation;

export const toEnrichedCorrelationsData = (correlationsResponse: CorrelationsResponse): CorrelationsData => {
  return {
    ...correlationsResponse,
    correlations: correlationsResponse.correlations.map(toEnrichedCorrelationData).filter(validSourceFilter),
  };
};
