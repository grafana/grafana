import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from './alertingApi';

export const convertToGMAApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    convertToGMA: build.mutation<
      void,
      {
        targetFolderUID?: string;
        pauseRecordingRules?: boolean;
        pauseAlerts?: boolean;
        payload:  RulerRulesConfigDTO;
      }
    >({
      query: ({ payload,targetFolderUID, pauseRecordingRules, pauseAlerts }) => ({
        url: `/api/convert/config/v1/rules`,
        params: { targetFolderUID, pauseRecordingRules, pauseAlerts },
        method: 'POST',
        body: payload,
      }),
    }),
  }),
});
