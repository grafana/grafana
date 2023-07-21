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
  const [annotationsWithHistory, setAnnotationsWithHistory] = useState<DataFrame[]>(annotations ?? []);

  const historyImplementation = useHistoryImplementation();
  const usingLokiAsImplementation = historyImplementation === StateHistoryImplementation.Loki;

  const { useGetRuleHistoryQuery } = stateHistoryApi;
  //todo: by dashboard id and panelid
  const { currentData: stateHistory } = useGetRuleHistoryQuery(
    {
      ruleUid: `ea7421dc-28ed-4f4a-8c71-1f42dbba6365`,
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
    records?.dataFrames && setAnnotationsWithHistory((prevAnnotations) => prevAnnotations.concat(records.dataFrames));
  }, [records?.dataFrames]);

  return annotationsWithHistory;
};
