import { useEffect } from 'react';

import { useDispatch } from 'app/types';

import { fetchAlertManagerConfigAction } from '../state/actions';
import { initialAsyncRequestState } from '../utils/redux';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useAlertmanagerConfig(amSourceName?: string) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (amSourceName) {
      dispatch(fetchAlertManagerConfigAction(amSourceName));
    }
  }, [amSourceName, dispatch]);

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  const { result, loading, error } = (amSourceName && amConfigs[amSourceName]) || initialAsyncRequestState;

  const config = result?.alertmanager_config;

  return { result, config, loading, error };
}
