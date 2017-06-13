import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import helpers from 'test/specs/helpers';
import HistorySrv from '../history/history_srv';
import { versions, compare, restore } from 'test/mocks/history-mocks';

describe('historySrv', function() {
  var ctx = new helpers.ServiceTestContext();

  var versionsResponse = versions();
  var restoreResponse = restore;

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.inject(function($httpBackend) {
    ctx.$httpBackend = $httpBackend;
    $httpBackend.whenRoute('GET', 'api/dashboards/id/:id/versions').respond(versionsResponse);
    $httpBackend.whenRoute('POST', 'api/dashboards/id/:id/restore')
      .respond(function(method, url, data, headers, params) {
        const parsedData = JSON.parse(data);
        return [200, restoreResponse(parsedData.version)];
      });
  }));
  beforeEach(ctx.createService('historySrv'));

  describe('getHistoryList', function() {
    it('should return a versions array for the given dashboard id', function(done) {
      ctx.service.getHistoryList({ id: 1 }).then(function(versions) {
        expect(versions).to.eql(versionsResponse);
        done();
      });
      ctx.$httpBackend.flush();
    });

    it('should return an empty array when not given an id', function(done) {
      ctx.service.getHistoryList({ }).then(function(versions) {
        expect(versions).to.eql([]);
        done();
      });
      ctx.$httpBackend.flush();
    });

    it('should return an empty array when not given a dashboard', function(done) {
      ctx.service.getHistoryList().then(function(versions) {
        expect(versions).to.eql([]);
        done();
      });
      ctx.$httpBackend.flush();
    });
  });

  describe('restoreDashboard', function() {
    it('should return a success response given valid parameters', function(done) {
      var version = 6;
      ctx.service.restoreDashboard({ id: 1 }, version).then(function(response) {
        expect(response).to.eql(restoreResponse(version));
        done();
      });
      ctx.$httpBackend.flush();
    });

    it('should return an empty object when not given an id', function(done) {
      ctx.service.restoreDashboard({}, 6).then(function(response) {
        expect(response).to.eql({});
        done();
      });
      ctx.$httpBackend.flush();
    });
  });
});
