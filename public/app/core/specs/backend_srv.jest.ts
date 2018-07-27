import { BackendSrv } from 'app/core/services/backend_srv';
jest.mock('app/core/store');

describe('backend_srv', function() {
  let _httpBackend = options => {
    console.log(options);
    if (options.url === 'gateway-error') {
      return Promise.reject({ status: 502 });
    }
    return Promise.resolve({});
  };

  let _backendSrv = new BackendSrv(_httpBackend, {}, {}, {}, {});

  //   beforeEach(angularMocks.module('grafana.core'));
  //   beforeEach(angularMocks.module('grafana.services'));
  //   beforeEach(
  //     angularMocks.inject(function($httpBackend, $http, backendSrv) {
  //       _httpBackend = $httpBackend;
  //       _backendSrv = backendSrv;
  //     })
  //   );

  describe('when handling errors', () => {
    it('should return the http status code', async () => {
      //   _httpBackend.whenGET('gateway-error').respond(502);
      let res = await _backendSrv.datasourceRequest({
        url: 'gateway-error',
      });
      console.log(res);
      expect(res.status).toBe(502);
      //   _httpBackend.flush();
    });
  });
});
