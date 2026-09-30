import { useEffect } from 'react';
import { useInterval } from 'react-use';

import { useDispatch } from 'app/types/store';

import { fetchGrafanaAnnotationsAction } from '../state/actions';
import { STATE_HISTORY_POLL_INTERVAL_MS } from '../utils/constants';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useManagedAlertStateHistory(ruleUID: string, pollingInterval = STATE_HISTORY_POLL_INTERVAL_MS) {
  const dispatch = useDispatch();
  const history = useUnifiedAlertingSelector((state) => state.managedAlertStateHistory);

  useEffect(() => {
    dispatch(fetchGrafanaAnnotationsAction(ruleUID));
  }, [dispatch, ruleUID]);

  useInterval(() => {
    if (!history.loading) {
      dispatch(fetchGrafanaAnnotationsAction(ruleUID));
    }
  }, pollingInterval);

  return {
    ...history,
    result: history.result?.ruleUID === ruleUID ? history.result.history : undefined,
  };
}
