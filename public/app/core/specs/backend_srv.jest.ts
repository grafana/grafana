import { BackendSrv } from 'app/core/services/backend_srv';
jest.mock('app/core/store');

describe('backend_srv', function() {
  let _httpBackend = options => {
    if (options.method === 'GET' && options.url === 'gateway-error') {
      return Promise.reject({ status: 502 });
    } else if (options.method === 'POST') {
      // return Promise.resolve({});
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

  describe('when handling errors', function() {
    it('should return the http status code', function(done) {
      //   _httpBackend.whenGET('gateway-error').respond(502);
      _backendSrv
        .datasourceRequest({
          url: 'gateway-error',
        })
        .catch(function(err) {
          expect(err.status).toBe(502);
          done();
        });
      //   _httpBackend.flush();
    });
  });
});
