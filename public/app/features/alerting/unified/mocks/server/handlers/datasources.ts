import { HttpResponse, http } from 'msw';

import { buildInfoResponse } from 'app/features/alerting/unified/testSetup/featureDiscovery';

/** UID of the alertmanager that is expected to be broken in tests */
export const MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER = 'FwkfQfEmYlAthB';
/** Display name of the alertmanager that is expected to be broken in tests */
export const MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER = 'broken alertmanager';
export const MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID = 'vanilla-alertmanager';
export const MOCK_DATASOURCE_PROVISIONED_MIMIR_ALERTMANAGER_UID = 'provisioned-alertmanager';
export const MOCK_DATASOURCE_GRAFANA_MIMIR = 'grafana-mimir';

const isSupportedType = (uid: string): uid is keyof typeof buildInfoResponse => {
  return uid in buildInfoResponse;
};

// TODO: Add more accurate endpoint responses as tests require
export const datasourceBuildInfoHandler = () =>
  http.get<{ datasourceUid: keyof typeof buildInfoResponse | string }>(
    '/api/datasources/proxy/uid/:datasourceUid/api/v1/status/buildinfo',
    ({ params }) => {
      const { datasourceUid } = params;
      if (isSupportedType(datasourceUid)) {
        const response = buildInfoResponse[datasourceUid];
        return HttpResponse.json(response);
      }
      return HttpResponse.json({});
    }
  );

// TODO: Add more accurate endpoint responses as tests require
const labelValuesHandler = () =>
  http.get('/api/datasources/uid/:datasourceUid/resources/api/v1/label/__name__/values', ({ params }) => {
    return HttpResponse.json({ status: 'sucess', data: [] });
  });

// TODO: Add more accurate endpoint responses as tests require
const resourcesLabelsHandler = () =>
  http.get('/api/datasources/uid/:datasourceUid/resources/api/v1/labels', () =>
    HttpResponse.json({ status: 'success', data: [] })
  );

// TODO: Add more accurate endpoint responses as tests require
const resourcesMetadataHandler = () =>
  http.get('/api/datasources/uid/:datasourceUid/resources/api/v1/metadata', () =>
    HttpResponse.json({ status: 'success', data: {} })
  );

const datasourcesHandlers = [
  datasourceBuildInfoHandler(),
  labelValuesHandler(),
  resourcesLabelsHandler(),
  resourcesMetadataHandler(),
];
export default datasourcesHandlers;
