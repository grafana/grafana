import { BackendSrv } from 'app/core/services/backend_srv';
jest.mock('app/core/store');

describe('backend_srv', function() {
  let _httpBackend = options => {
    if (options.url === 'gateway-error') {
      return Promise.reject({ status: 502 });
    }
    return Promise.resolve({});
  };

  let _backendSrv = new BackendSrv(_httpBackend, {}, {}, {}, {});

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
