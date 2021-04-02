import { useEffect, useState } from 'react';
import { SettingsService } from '../../../settings/Settings.service';
import { Settings } from '../../../settings/Settings.types';

export const useAzure = () => {
  const [showAzure, setShowAzure] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings>();

  const getSettings = () => {
    SettingsService.getSettings(() => {}, setSettings).then();
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
