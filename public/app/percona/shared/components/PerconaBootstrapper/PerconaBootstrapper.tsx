import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setSettings, setSettingsLoading, setAuthorized } from 'app/percona/shared/core/reducers';
import { SettingsService } from 'app/percona/settings/Settings.service';

// This component is only responsible for populating the store with Percona's settings initially
export const PerconaBootstrapper = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const getSettings = async () => {
      try {
        dispatch(setSettingsLoading(true));
        const settings = await SettingsService.getSettings(undefined, true);
        dispatch(setSettings(settings));
        dispatch(setAuthorized(true));
      } catch (e) {
        if (e.response?.status === 401) {
          setAuthorized(false);
        }
        dispatch(setSettingsLoading(false));
      }
    };

    getSettings();
  }, [dispatch]);

  return <></>;
};
