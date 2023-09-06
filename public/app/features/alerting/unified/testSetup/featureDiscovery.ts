import { PromBuildInfoResponse } from 'app/types/unified-alerting-dto';

export const buildInfoResponse: { prometheus: PromBuildInfoResponse; mimir: PromBuildInfoResponse } = {
  prometheus: {
    status: 'success',
    data: {
      version: '2.45.0',
      revision: '8ef767e396bf8445f009f945b0162fd71827f445',
      branch: 'HEAD',
      buildUser: 'root@920118f645b7',
      buildDate: '20230623-15:15:37',
      goVersion: 'go1.20.5',
    },
  },
  mimir: {
    status: 'success',
    data: {
      application: 'Grafana Mimir',
      version: 'r249-5bedc7a1-WIP',
      revision: '5bedc7a1',
      branch: 'weekly-r249',
      goVersion: 'go1.20.5',
      features: {
        ruler_config_api: 'true',
        alertmanager_config_api: 'true',
        query_sharding: 'false',
        federated_rules: 'false',
      },
    },
  },
};
