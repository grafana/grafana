import { useEffect } from 'react';

import { useDispatch } from 'app/types';
import { StateHistoryItem } from 'app/types/unified-alerting';

import { fetchGrafanaAnnotationsAction } from '../state/actions';
import { AsyncRequestState } from '../utils/redux';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useManagedAlertStateHistory(alertId: string, oldAlertId: string) { // LOGZ.IO GRAFANA CHANGE :: DEV-31760 - Retrieve annotations for migrated unified alerts
  const dispatch = useDispatch();
  const history = useUnifiedAlertingSelector<AsyncRequestState<StateHistoryItem[]>>(
    (state) => state.managedAlertStateHistory
  );

  // LOGZ.IO GRAFANA CHANGE :: DEV-31760 - Retrieve annotations for migrated unified alerts
  useEffect(() => {
    dispatch(fetchGrafanaAnnotationsAction({alertId, oldAlertId}));
  }, [dispatch, alertId, oldAlertId]);
  // LOGZ.IO GRAFANA CHANGE :: end

  return history;
}
