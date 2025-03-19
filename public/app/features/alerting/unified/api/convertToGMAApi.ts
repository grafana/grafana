import { alertingApi } from './alertingApi';

export const convertToGMAApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    convertToGMA: build.mutation<
      void,
      {
        datasourceUID: string;
        namespace?: string;
        group?: string;
        targetFolderUID?: string;
        pauseRecordingRules?: boolean;
        pauseAlerts?: boolean;
      }
    >({
      query: ({ datasourceUID, namespace, group, targetFolderUID, pauseRecordingRules, pauseAlerts }) => ({
        url: `/api/convert/${datasourceUID}/config/v1/rules`,
        params: { namespace, group, targetFolderUID, pauseRecordingRules, pauseAlerts },
        method: 'POST',
      }),
    }),
  }),
});
