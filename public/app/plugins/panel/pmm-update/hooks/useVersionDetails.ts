import { useEffect, useState } from 'react';

import { getCurrentVersion } from '../UpdatePanel.service';
import { formatDateWithYear, formatDateWithTime } from '../UpdatePanel.utils';
import { useApiCall } from '../hooks';
import {
  CurrentOrNextVersionDetails,
  GetUpdatesParams,
  GetUpdatesResponse,
  InstalledVersionDetails,
  NextVersionDetails,
} from '../types';

export const useVersionDetails = (initialForceUpdate = false): CurrentOrNextVersionDetails => {
  const [isDefaultView, setIsDefaultView] = useState(true);
  const [nextVersionDetails, setNextVersionDetails] = useState<NextVersionDetails>({
    nextVersion: '',
    nextFullVersion: '',
    nextVersionDate: '',
    newsLink: '',
  });
  const [installedVersionDetails, setInstalledVersionDetails] = useState<InstalledVersionDetails>({
    installedVersion: '',
    installedFullVersion: '',
    installedVersionDate: '',
  });
  const [lastCheckDate, setLastCheckDate] = useState('');
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [data, errorMessage, isLoading, getVersionDetails] = useApiCall<GetUpdatesResponse | void, GetUpdatesParams>(
    getCurrentVersion,
    { force: initialForceUpdate },
    { force: initialForceUpdate, only_installed_version: true }
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    const {
      last_check,
      latest = {
        full_version: undefined,
        timestamp: undefined,
        version: undefined,
      },
      latest_news_url,
      installed,
      update_available,
    } = data;
    const { full_version: latestFullVersion, timestamp: latestTimestamp, version: latestVersion } = latest;
    const {
      full_version: installedFullVersion,
      timestamp: installedVersionTimestamp,
      version: installedVersion,
    } = installed;

    setNextVersionDetails({
      nextVersion: latestVersion ?? '',
      nextFullVersion: latestFullVersion ?? '',
      nextVersionDate: latestTimestamp ? formatDateWithYear(latestTimestamp) : '',
      newsLink: latest_news_url ?? '',
    });
    setInstalledVersionDetails({
      installedVersion: installedVersion ?? '',
      installedFullVersion: installedFullVersion ?? '',
      installedVersionDate: installedVersionTimestamp ? formatDateWithYear(installedVersionTimestamp) : '',
    });
    setLastCheckDate(last_check ? formatDateWithTime(last_check) : '');
    setIsUpdateAvailable(update_available ?? false);
    setIsDefaultView(false);
  }, [data]);

  return [
    {
      installedVersionDetails,
      lastCheckDate,
      nextVersionDetails,
      isUpdateAvailable,
    },
    errorMessage,
    isLoading,
    isDefaultView,
    getVersionDetails,
  ];
};
