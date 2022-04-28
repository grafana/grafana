import React, { useEffect } from 'react';
import { useAppDispatch } from 'app/store/store';
import {
  fetchSettingsAction,
  setAuthorized,
  fetchServerInfoAction,
  fetchServerSaasHostAction,
  fetchUserStatusAction,
} from 'app/percona/shared/core/reducers';
import { contextSrv } from 'app/core/services/context_srv';

// This component is only responsible for populating the store with Percona's settings initially
export const PerconaBootstrapper = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const getSettings = async () => {
      try {
        await dispatch(fetchSettingsAction()).unwrap();
        dispatch(setAuthorized(true));
      } catch (e) {
        if (e.response?.status === 401) {
          setAuthorized(false);
        }
      }
    };

    const bootstrap = async () => {
      await getSettings();
      await dispatch(fetchUserStatusAction());
      await dispatch(fetchServerInfoAction());
      await dispatch(fetchServerSaasHostAction());
    };

    if (contextSrv.user.isSignedIn) {
      bootstrap();
    }
  }, [dispatch]);

  return <></>;
};
