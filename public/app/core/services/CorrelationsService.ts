import { type DataFrame } from '@grafana/data/dataframe';
import type { TimeRange } from '@grafana/data/types';
import type { CorrelationData, CorrelationsService as CorrelationsServiceInterface } from '@grafana/runtime';
import { attachCorrelationsToDataFrames, getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';
import { exploreDataLinkPostProcessorFactory } from 'app/features/explore/utils/links';

export class CorrelationsService implements CorrelationsServiceInterface {
  attachCorrelationsToDataFrames(
    dataFrames: DataFrame[],
    correlations: CorrelationData[],
    dataFrameRefIdToDataSourceUid: Record<string, string>
  ) {
    return attachCorrelationsToDataFrames(dataFrames, correlations, dataFrameRefIdToDataSourceUid);
  }

  correlationsDataLinkPostProcessorFactory(timeRange: TimeRange) {
    return exploreDataLinkPostProcessorFactory(undefined, timeRange);
  }

  getCorrelationsBySourceUIDs(sourceUIDs: string[]) {
    return getCorrelationsBySourceUIDs(sourceUIDs);
  }
}
