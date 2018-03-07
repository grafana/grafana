define([
  'app/core/config',
  'app/core/services/backend_srv'
], function() {
  'use strict';

  describe('backend_srv', function() {
    var _backendSrv;
    var _http;
    var _httpBackend;

    beforeEach(module('grafana.core'));
    beforeEach(module('grafana.services'));
    beforeEach(inject(function ($httpBackend, $http, backendSrv) {
      _httpBackend = $httpBackend;
      _http = $http;
      _backendSrv = backendSrv;
    }));

    describe('when handling errors', function() {
      it('should return the http status code', function(done) {
        _httpBackend.whenGET('gateway-error').respond(502);
        _backendSrv.datasourceRequest({
          url: 'gateway-error'
        }).catch(function(err) {
          expect(err.status).to.be(502);
          done();
        });
        _httpBackend.flush();
      });
    });
  });
});
