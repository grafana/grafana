import { DataFrame, TimeRange } from '@grafana/data';
import type { CorrelationData, CorrelationsService as CorrelationsServiceInterface } from '@grafana/runtime';
import { attachCorrelationsToDataFrames, getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';
import { exploreDataLinkPostProcessorFactory } from 'app/features/explore/utils/links';

export class CorrelationsService implements CorrelationsServiceInterface {
  // TODO: Description
  getCorrelationsBySourceUIDs(sourceUIDs: string[]) {
    return getCorrelationsBySourceUIDs(sourceUIDs);
  }

  // TODO: Description
  correlationsDataLinkPostProcessorFactory(timeRange: TimeRange) {
    return exploreDataLinkPostProcessorFactory(undefined, timeRange);
  }

  // TODO: Description
  attachCorrelationsToDataFrames(
    dataFrames: DataFrame[],
    correlations: CorrelationData[],
    dataFrameRefIdToDataSourceUid: Record<string, string>
  ) {
    return attachCorrelationsToDataFrames(dataFrames, correlations, dataFrameRefIdToDataSourceUid);
  }
}
