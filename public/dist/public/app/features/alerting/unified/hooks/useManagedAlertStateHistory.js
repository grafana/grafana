import { useEffect } from 'react';
import { useDispatch } from 'app/types';
import { fetchGrafanaAnnotationsAction } from '../state/actions';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
export function useManagedAlertStateHistory(alertId) {
    const dispatch = useDispatch();
    const history = useUnifiedAlertingSelector((state) => state.managedAlertStateHistory);
    useEffect(() => {
        dispatch(fetchGrafanaAnnotationsAction(alertId));
    }, [dispatch, alertId]);
    return history;
}
//# sourceMappingURL=useManagedAlertStateHistory.js.map