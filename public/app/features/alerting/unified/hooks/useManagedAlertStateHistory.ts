import { useCallback, useEffect, useState } from 'react';
import { useInterval } from 'react-use';

import { useDispatch } from 'app/types/store';

import { fetchGrafanaAnnotationsAction } from '../state/actions';
import { STATE_HISTORY_POLL_INTERVAL_MS } from '../utils/constants';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useManagedAlertStateHistory(ruleUID: string, pollingInterval = STATE_HISTORY_POLL_INTERVAL_MS) {
  const dispatch = useDispatch();
  const history = useUnifiedAlertingSelector((state) => state.managedAlertStateHistory);
  const [request, setRequest] = useState<{ ruleUID: string; requestId: string }>();

  const fetchHistory = useCallback(() => {
    const { requestId } = dispatch(fetchGrafanaAnnotationsAction(ruleUID));
    setRequest({ ruleUID, requestId });
  }, [dispatch, ruleUID]);

  useEffect(fetchHistory, [fetchHistory]);

  useInterval(() => {
    if (!history.loading) {
      fetchHistory();
    }
  }, pollingInterval);

  const isCurrentRequest = request?.ruleUID === ruleUID && request?.requestId === history.requestId;

  return {
    ...history,
    loading: !isCurrentRequest || history.loading,
    error: isCurrentRequest && !history.loading ? history.error : undefined,
    result: history.result?.ruleUID === ruleUID ? history.result.history : undefined,
  };
}
