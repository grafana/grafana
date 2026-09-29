import { useEffect } from 'react';
import { useInterval } from 'react-use';

import { useDispatch } from 'app/types/store';
import { type StateHistoryItem } from 'app/types/unified-alerting';

import { fetchGrafanaAnnotationsAction } from '../state/actions';
import { STATE_HISTORY_POLL_INTERVAL_MS } from '../utils/constants';
import { type AsyncRequestState } from '../utils/redux';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useManagedAlertStateHistory(ruleUID: string) {
  const dispatch = useDispatch();
  const history = useUnifiedAlertingSelector<AsyncRequestState<StateHistoryItem[]>>(
    (state) => state.managedAlertStateHistory
  );

  useEffect(() => {
    dispatch(fetchGrafanaAnnotationsAction(ruleUID));
  }, [dispatch, ruleUID]);

  useInterval(() => {
    if (!history.loading) {
      dispatch(fetchGrafanaAnnotationsAction(ruleUID));
    }
  }, STATE_HISTORY_POLL_INTERVAL_MS);

  return history;
}
