import { of } from 'rxjs';

import { type CustomVariableModel } from '@grafana/data';
import { getBackendSrv, setBackendSrv } from '@grafana/runtime';

import { ResourcesAPI } from '../resources/ResourcesAPI';

import { CloudWatchSettings, setupMockedTemplateService } from './CloudWatchDataSource';

export function setupMockedResourcesAPI({
  variables,
  response,
  getMock,
  fetchResponse,
}: {
  getMock?: jest.Mock;
  response?: unknown;
  fetchResponse?: { data?: unknown; headers?: Headers };
  variables?: CustomVariableModel[];
  mockGetVariableName?: boolean;
} = {}) {
  let templateService = setupMockedTemplateService(variables);

  const api = new ResourcesAPI(CloudWatchSettings, templateService);
  let resourceRequestMock = getMock ? getMock : jest.fn().mockReturnValue(response);
  const fetchMock = jest.fn().mockReturnValue(
    of({
      data: fetchResponse?.data ?? response,
      headers: fetchResponse?.headers ?? new Headers(),
      status: 200,
      ok: true,
      config: { url: '' },
    })
  );
  setBackendSrv({
    ...getBackendSrv(),
    get: resourceRequestMock,
    fetch: fetchMock,
  });

  return { api, resourceRequestMock, fetchMock, templateService };
}
