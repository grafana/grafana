import { AlertmanagerGroup, AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { useMemo } from 'react';

export const useFlatAmAlerts = (groups: AlertmanagerGroup[]) =>
  useMemo(() => {
    return groups.reduce((flatAlerts, { alerts }) => {
      flatAlerts.push(...alerts);
      return flatAlerts;
    }, [] as AlertmanagerAlert[]);
  }, [groups]);
