import { http, HttpResponse } from 'msw';

/** UID of the alertmanager that is expected to be broken in tests */
export const MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER = 'FwkfQfEmYlAthB';
/** Display name of the alertmanager that is expected to be broken in tests */
export const MOCK_DATASOURCE_NAME_BROKEN_ALERTMANAGER = 'broken alertmanager';
export const MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID = 'vanilla-alertmanager';
export const MOCK_DATASOURCE_PROVISIONED_MIMIR_ALERTMANAGER_UID = 'provisioned-alertmanager';

// TODO: Add more accurate endpoint responses as tests require
export const datasourceBuildInfoHandler = () =>
  http.get('/api/datasources/proxy/uid/:datasourceUid/api/v1/status/buildinfo', () => HttpResponse.json({}));

const datasourcesHandlers = [datasourceBuildInfoHandler()];
export default datasourcesHandlers;
