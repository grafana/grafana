import { of } from 'rxjs';

import Api from './api';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { createFetchResponse } from 'test/helpers/createFetchResponse';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

const response = [
  { label: 'test1', value: 'test1' },
  { label: 'test2', value: 'test2' },
];

type Args = { path?: string; options?: any; response?: any; cache?: any };

async function getTestContext({ path = 'some-resource', options = {}, response = {}, cache }: Args = {}) {
  jest.clearAllMocks();

  const fetchMock = jest.spyOn(backendSrv, 'fetch');

  fetchMock.mockImplementation((options: any) => {
    const data = { [options.url.match(/([^\/]*)\/*$/)![1].split('?')[0]]: response };
    return of(createFetchResponse(data));
  });

  const api = new Api('/cloudmonitoring/');

  if (cache) {
    api.cache[path] = cache;
  }

  const res = await api.get(path, options);

  return { res, api, fetchMock };
}

describe('api', () => {
  describe('when resource was cached', () => {
    test.each(['some-resource', 'some-resource?some=param', 'test/some-resource?param'])(
      'should return cached value and not load from source',
      async (path) => {
        const { res, api, fetchMock } = await getTestContext({ path, cache: response });

        expect(res).toEqual(response);
        expect(api.cache[path]).toEqual(response);
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );
  });

  describe('when resource was not cached', () => {
    test.each(['some-resource', 'some-resource?some=param', 'test/some-resource?param'])(
      'should return from source and not from cache',
      async (path) => {
        const { res, api, fetchMock } = await getTestContext({ path, response });

        expect(res).toEqual(response);
        expect(api.cache[path]).toEqual(response);
        expect(fetchMock).toHaveBeenCalled();
      }
    );
  });

  describe('when cache should be bypassed', () => {
    test.each(['some-resource', 'some-resource?some=param', 'test/some-resource?param'])(
      'should return from source and not from cache',
      async (path) => {
        const options = { useCache: false };
        const { res, fetchMock } = await getTestContext({ path, response, cache: response, options });

        expect(res).toEqual(response);
        expect(fetchMock).toHaveBeenCalled();
      }
    );
  });
});
