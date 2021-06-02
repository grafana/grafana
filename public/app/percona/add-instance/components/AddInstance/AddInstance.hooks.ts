import { useEffect, useState } from 'react';
import { logger } from '@percona/platform-core';
import { SettingsService } from '../../../settings/Settings.service';
import { Settings } from '../../../settings/Settings.types';

export const useAzure = () => {
  const [showAzure, setShowAzure] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings>();

  const getSettings = async () => {
    try {
      const settings = await SettingsService.getSettings();
      setSettings(settings);
    } catch (e) {
      logger.error(e);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setShowAzure(!!settings.azureDiscoverEnabled);
    }
  }, [settings]);

  return [showAzure];
};
