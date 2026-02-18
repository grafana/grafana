import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { isFetchError } from '@grafana/runtime';
import { AlertmanagerAlert, Silence } from 'app/plugins/datasource/alertmanager/types';

import { alertSilencesApi } from '../api/alertSilencesApi';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { useAlertmanager } from '../state/AlertmanagerContext';
import { getDatasourceAPIUid } from '../utils/datasource';

interface UseSilenceViewDataResult {
  silence?: Silence;
  silencedAlerts: AlertmanagerAlert[];
  isLoading: boolean;
  error: unknown;
  isNotFound: boolean;
}

export function useSilenceViewData(): UseSilenceViewDataResult {
  const { id: silenceId = '' } = useParams();
  const { selectedAlertmanager: alertManagerSourceName = '' } = useAlertmanager();

  const {
    data: silence,
    isLoading,
    error,
  } = alertSilencesApi.endpoints.getSilence.useQuery({
    id: silenceId,
    datasourceUid: getDatasourceAPIUid(alertManagerSourceName),
    ruleMetadata: true,
    accessControl: true,
  });

  const { data: alertManagerAlerts = [] } = alertmanagerApi.endpoints.getAlertmanagerAlerts.useQuery({
    amSourceName: alertManagerSourceName,
    filter: { silenced: true, active: false, inhibited: false },
  });

  const silencedAlerts = useMemo(() => {
    return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(silenceId));
  }, [alertManagerAlerts, silenceId]);

  return {
    silence,
    silencedAlerts,
    isLoading,
    error,
    isNotFound: isFetchError(error) && error.status === 404,
  };
}
