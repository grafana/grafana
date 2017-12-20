import {
  describe,
  beforeEach,
  it,
  expect,
  angularMocks,
} from 'test/lib/common';
import 'app/core/services/backend_srv';

describe('backend_srv', function() {
  var _backendSrv;
  var _httpBackend;

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(
    angularMocks.inject(function($httpBackend, $http, backendSrv) {
      _httpBackend = $httpBackend;
      _backendSrv = backendSrv;
    })
  );

  describe('when handling errors', function() {
    it('should return the http status code', function(done) {
      _httpBackend.whenGET('gateway-error').respond(502);
      _backendSrv
        .datasourceRequest({
          url: 'gateway-error',
        })
        .catch(function(err) {
          expect(err.status).to.be(502);
          done();
        });
      _httpBackend.flush();
    });
  });
});
