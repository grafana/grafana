import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from './alertingApi';

export const convertToGMAApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    convertToGMA: build.mutation<
      void,
      {
        targetFolderUID?: string;
        dataSourceUID: string;
        pauseRecordingRules?: boolean;
        pauseAlerts?: boolean;
        payload:  RulerRulesConfigDTO;
      }
    >({
      query: ({ payload,targetFolderUID, pauseRecordingRules, pauseAlerts,dataSourceUID }) => ({
        url: `/api/convert/prometheus/config/v1/rules`,
        params: { targetFolderUID, pauseRecordingRules, pauseAlerts },
        method: 'POST',
        body: payload,
        headers: {
          'X-Grafana-Alerting-Datasource-UID':dataSourceUID,
          'X-Grafana-Alerting-Recording-Rules-Paused':pauseRecordingRules,
          'X-Grafana-Alerting-Alert-Rules-Paused':pauseAlerts,
          'X-Grafana-Alerting-Folder-UID':targetFolderUID,
        },
      }),
    }),
  }),
});
