import { getRequestWithCancel } from './getRequestWithCancel';
import { BackendSrv } from '@grafana/runtime';

describe('getRequestWithCancel', () => {
  describe('when doing an successful request', () => {
    it('should return correct result', async () => {
      const datasourceRequestMock = jest.fn().mockResolvedValue({ data: [{ target: 'servers', datapoints: [] }] });
      const dependencies = {
        getBackendSrv: () => {
          return ({
            datasourceRequest: datasourceRequestMock,
          } as unknown) as BackendSrv;
        },
      };
      const result = await getRequestWithCancel({ url: 'api/annotations', params: {}, requestId: 'A' }, dependencies);

      expect(result).toEqual([{ target: 'servers', datapoints: [] }]);
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({ url: 'api/annotations', params: {}, requestId: 'A' });
    });
  });

  describe('when doing a request that gets cancelled', () => {
    it('should return an empty array', async () => {
      const url = 'api/annotations';
      const params = {};
      const datasourceRequestMock = jest.fn().mockRejectedValue({ cancelled: true, url, params });
      const dependencies = {
        getBackendSrv: () => {
          return ({
            datasourceRequest: datasourceRequestMock,
          } as unknown) as BackendSrv;
        },
      };
      const result = await getRequestWithCancel({ url, params, requestId: 'A' }, dependencies);

      expect(result).toEqual([]);
      expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
      expect(datasourceRequestMock).toHaveBeenCalledWith({ url: 'api/annotations', params: {}, requestId: 'A' });
    });
  });

  describe('when doing a request that throws', () => {
    it('should rethrow the error', async () => {
      const url = 'api/annotations';
      const params = {};
      const datasourceRequestMock = jest.fn().mockRejectedValue({ url, params });
      const dependencies = {
        getBackendSrv: () => {
          return ({
            datasourceRequest: datasourceRequestMock,
          } as unknown) as BackendSrv;
        },
      };

      getRequestWithCancel({ url, params, requestId: 'A' }, dependencies).catch(err => {
        expect(err).toEqual({ url, params });
        expect(datasourceRequestMock).toHaveBeenCalledTimes(1);
        expect(datasourceRequestMock).toHaveBeenCalledWith({ url: 'api/annotations', params: {}, requestId: 'A' });
      });
    });
  });
});
