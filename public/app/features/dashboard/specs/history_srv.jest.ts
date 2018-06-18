import '../history/history_srv';
import { versions, restore } from './history_mocks';
import { HistorySrv } from '../history/history_srv';

describe('historySrv', function() {
  var versionsResponse = versions();
  var restoreResponse = restore;

  var backendSrv = {
    get: jest.fn(() => Promise.resolve({})),
    post: jest.fn(() => Promise.resolve({})),
  };

  var q = {
    when: jest.fn(() => Promise.resolve([])),
  };

  var historySrv = new HistorySrv(backendSrv, q);

  describe('getHistoryList', function() {
    it('should return a versions array for the given dashboard id', function() {
      backendSrv.get = jest.fn(() => Promise.resolve(versionsResponse));
      historySrv = new HistorySrv(backendSrv, q);

      return historySrv.getHistoryList({ id: 1 }).then(function(versions) {
        expect(versions).toEqual(versionsResponse);
      });
    });

    it('should return an empty array when not given an id', function() {
      return historySrv.getHistoryList({}).then(function(versions) {
        expect(versions).toEqual([]);
      });
    });

    it('should return an empty array when not given a dashboard', function() {
      return historySrv.getHistoryList().then(function(versions) {
        expect(versions).toEqual([]);
      });
    });
  });

  describe('restoreDashboard', function() {
    it('should return a success response given valid parameters', function() {
      let version = 6;
      backendSrv.post = jest.fn(() => Promise.resolve(restoreResponse(version)));
      historySrv = new HistorySrv(backendSrv, q);
      return historySrv.restoreDashboard({ id: 1 }, version).then(function(response) {
        expect(response).toEqual(restoreResponse(version));
      });
    });

    it('should return an empty object when not given an id', function() {
      q.when = jest.fn(() => Promise.resolve({}));
      historySrv = new HistorySrv(backendSrv, q);
      return historySrv.restoreDashboard({}, 6).then(function(response) {
        expect(response).toEqual({});
      });
    });
  });
});
