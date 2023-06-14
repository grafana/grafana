import { useEffect } from 'react';

import { config } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCorrelations } from 'app/features/correlations/useCorrelations';
import { useDispatch } from 'app/types';

import { saveCorrelationsAction } from '../state/main';

export function useExploreCorrelations() {
  const { get } = useCorrelations();
  const { warning } = useAppNotification();

  const dispatch = useDispatch();
  useEffect(() => {
    if (!config.featureToggles.correlations) {
      dispatch(saveCorrelationsAction([]));
    } else {
      get.execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (get.value) {
      dispatch(saveCorrelationsAction(get.value));
    } else if (get.error) {
      dispatch(saveCorrelationsAction([]));
      warning(
        'Could not load correlations.',
        'Correlations data could not be loaded, DataLinks may have partial data.'
      );
    }
  }, [get.value, get.error, dispatch, warning]);
}
