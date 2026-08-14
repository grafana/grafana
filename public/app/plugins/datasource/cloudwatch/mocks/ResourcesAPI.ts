import { of } from 'rxjs';

import { type CustomVariableModel } from '@grafana/data';
import { getBackendSrv, setBackendSrv } from '@grafana/runtime';

import { ResourcesAPI } from '../resources/ResourcesAPI';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';

export function setupMockedResourcesAPI({
  variables,
  response,
  getMock,
  fetchMock,
}: {
  getMock?: jest.Mock;
  fetchMock?: jest.Mock;
  response?: unknown;
  variables?: CustomVariableModel[];
  mockGetVariableName?: boolean;
} = {}) {
  let templateService = setupMockedTemplateService(variables);

  const api = new ResourcesAPI(CloudWatchSettings, templateService);
  const resourceRequestMock = getMock ? getMock : jest.fn().mockReturnValue(response);
  const defaultFetchMock = fetchMock ?? jest.fn().mockReturnValue(of({ data: response, headers: new Headers() }));
  setBackendSrv({
    ...getBackendSrv(),
    get: resourceRequestMock,
    fetch: defaultFetchMock,
  });

  return { api, resourceRequestMock, fetchMock: defaultFetchMock, templateService };
}
