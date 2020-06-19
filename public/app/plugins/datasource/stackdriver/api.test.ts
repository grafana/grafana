import Api from './api';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { SelectableValue } from '@grafana/data';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

const response = [
  { label: 'test1', value: 'test1' },
  { label: 'test2', value: 'test2' },
];

describe('api', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');
  beforeEach(() => {
    datasourceRequestMock.mockImplementation((options: any) => {
      const data = { [options.url.match(/([^\/]*)\/*$/)[1]]: response };
      return Promise.resolve({ data, status: 200 });
    });
  });

  describe('when resource was cached', () => {
    let api: Api;
    let res: Array<SelectableValue<string>>;
    beforeEach(async () => {
      api = new Api('/stackdriver/');
      api.cache['some-resource'] = response;
      res = await api.get('some-resource');
    });

    it('should return cached value and not load from source', () => {
      expect(res).toEqual(response);
      expect(api.cache['some-resource']).toEqual(response);
      expect(datasourceRequestMock).not.toHaveBeenCalled();
    });
  });

  describe('when resource was not cached', () => {
    let api: Api;
    let res: Array<SelectableValue<string>>;
    beforeEach(async () => {
      api = new Api('/stackdriver/');
      res = await api.get('some-resource');
    });

    it('should return cached value and not load from source', () => {
      expect(res).toEqual(response);
      expect(api.cache['some-resource']).toEqual(response);
      expect(datasourceRequestMock).toHaveBeenCalled();
    });
  });

  describe('when cache should be bypassed', () => {
    let api: Api;
    let res: Array<SelectableValue<string>>;
    beforeEach(async () => {
      api = new Api('/stackdriver/');
      api.cache['some-resource'] = response;
      res = await api.get('some-resource', { useCache: false });
    });

    it('should return cached value and not load from source', () => {
      expect(res).toEqual(response);
      expect(datasourceRequestMock).toHaveBeenCalled();
    });
  });
});
