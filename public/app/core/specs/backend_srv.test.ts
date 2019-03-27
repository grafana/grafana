import angular from 'angular';
import { BackendSrv } from 'app/core/services/backend_srv';
import { ContextSrv } from '../services/context_srv';
jest.mock('app/core/store');

describe('backend_srv', () => {
  const _httpBackend = options => {
    if (options.url === 'gateway-error') {
      return Promise.reject({ status: 502 });
    }
    return Promise.resolve({});
  };

  const _backendSrv = new BackendSrv(
    _httpBackend,
    {} as angular.IQService,
    {} as angular.ITimeoutService,
    {} as ContextSrv
  );

  describe('when handling errors', () => {
    it('should return the http status code', async () => {
      try {
        await _backendSrv.datasourceRequest({
          url: 'gateway-error',
        });
      } catch (err) {
        expect(err.status).toBe(502);
      }
    });
  });
});
