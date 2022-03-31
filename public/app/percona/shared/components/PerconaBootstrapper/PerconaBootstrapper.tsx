import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  setSettings,
  setSettingsLoading,
  setAuthorized,
  fetchServerInfoAction,
  setIsPlatformUser,
} from 'app/percona/shared/core/reducers';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { UserService } from '../../services/user/User.service';
import { logger } from '@percona/platform-core';

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

    const getUserStatus = async () => {
      try {
        const isPlatformUser = await UserService.getUserStatus(undefined, true);
        dispatch(setIsPlatformUser(isPlatformUser));
      } catch (e) {
        logger.error(e);
      }
    };

    getSettings();
    getUserStatus();
    dispatch(fetchServerInfoAction());
  }, [dispatch]);

  return <></>;
};
