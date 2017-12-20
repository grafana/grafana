import {
  describe,
  beforeEach,
  it,
  expect,
  angularMocks,
} from 'test/lib/common';

import helpers from 'test/specs/helpers';
import '../history/history_srv';
import { versions, restore } from './history_mocks';

describe('historySrv', function() {
  var ctx = new helpers.ServiceTestContext();

  var versionsResponse = versions();
  var restoreResponse = restore;

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(
    angularMocks.inject(function($httpBackend) {
      ctx.$httpBackend = $httpBackend;
      $httpBackend
        .whenRoute('GET', 'api/dashboards/id/:id/versions')
        .respond(versionsResponse);
      $httpBackend
        .whenRoute('POST', 'api/dashboards/id/:id/restore')
        .respond(function(method, url, data, headers, params) {
          const parsedData = JSON.parse(data);
          return [200, restoreResponse(parsedData.version)];
        });
    })
  );

  beforeEach(ctx.createService('historySrv'));

  function wrapPromise(ctx, angularPromise) {
    return new Promise((resolve, reject) => {
      angularPromise.then(resolve, reject);
      ctx.$httpBackend.flush();
    });
  }

  describe('getHistoryList', function() {
    it('should return a versions array for the given dashboard id', function() {
      return wrapPromise(
        ctx,
        ctx.service.getHistoryList({ id: 1 }).then(function(versions) {
          expect(versions).to.eql(versionsResponse);
        })
      );
    });

    it('should return an empty array when not given an id', function() {
      return wrapPromise(
        ctx,
        ctx.service.getHistoryList({}).then(function(versions) {
          expect(versions).to.eql([]);
        })
      );
    });

    it('should return an empty array when not given a dashboard', function() {
      return wrapPromise(
        ctx,
        ctx.service.getHistoryList().then(function(versions) {
          expect(versions).to.eql([]);
        })
      );
    });
  });

  describe('restoreDashboard', function() {
    it('should return a success response given valid parameters', function() {
      let version = 6;
      return wrapPromise(
        ctx,
        ctx.service
          .restoreDashboard({ id: 1 }, version)
          .then(function(response) {
            expect(response).to.eql(restoreResponse(version));
          })
      );
    });

    it('should return an empty object when not given an id', function() {
      return wrapPromise(
        ctx,
        ctx.service.restoreDashboard({}, 6).then(function(response) {
          expect(response).to.eql({});
        })
      );
    });
  });
});
