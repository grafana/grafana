import { useEffect, useState } from 'react';

import { DataFrame, TimeRange } from '@grafana/data';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { StateHistoryImplementation, useHistoryImplementation } from '../../../hooks/useStateHistoryModal';

import { useRuleHistoryRecordsForPanel } from './useRuleHistoryRecords';

type UseGetAnnotationsWithHistoryOptions = {
  annotations: DataFrame[] | undefined;
  timeRange: TimeRange;
};

export const useGetAnnotationsWithHistory = ({ timeRange, annotations }: UseGetAnnotationsWithHistoryOptions) => {
  // Getting annotations from Loki state history in case we are in new alerting state history mode
  const [annotationsWithHistory, setAnnotationsWithHistory] = useState<DataFrame[]>([]);

  const historyImplementation = useHistoryImplementation();
  const usingLokiAsImplementation = historyImplementation === StateHistoryImplementation.Loki;

  const { useGetRuleHistoryQuery } = stateHistoryApi;
  //todo: by dashboard id and panelid
  const { currentData: stateHistory } = useGetRuleHistoryQuery(
    {
      ruleUid: `b6a0008b-a29e-46f6-b3dc-d9eac6c8ce2a`,
      from: timeRange.from.unix(),
      to: timeRange.to.unix(),
      limit: 250,
    },
    {
      skip: !usingLokiAsImplementation,
    }
  );

  // we convert the state history records to DataFrames in the same format as annotations are in the time series panel
  const records = useRuleHistoryRecordsForPanel(stateHistory);

  useEffect(() => {
    records?.dataFrames &&
      setAnnotationsWithHistory(annotations ? annotations.concat(records.dataFrames) : records.dataFrames);
  }, [annotations, records?.dataFrames]);

  return annotationsWithHistory;
};
