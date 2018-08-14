import '../history/history_srv';
import { versions, restore } from './history_mocks';
import { HistorySrv } from '../history/history_srv';
import { DashboardModel } from '../dashboard_model';
jest.mock('app/core/store');

describe('historySrv', function() {
  const versionsResponse = versions();
  const restoreResponse = restore;

  let backendSrv = {
    get: jest.fn(() => Promise.resolve({})),
    post: jest.fn(() => Promise.resolve({})),
  };

  let historySrv = new HistorySrv(backendSrv);

  const dash = new DashboardModel({ id: 1 });
  const emptyDash = new DashboardModel({});
  const historyListOpts = { limit: 10, start: 0 };

  describe('getHistoryList', function() {
    it('should return a versions array for the given dashboard id', function() {
      backendSrv.get = jest.fn(() => Promise.resolve(versionsResponse));
      historySrv = new HistorySrv(backendSrv);

      return historySrv.getHistoryList(dash, historyListOpts).then(function(versions) {
        expect(versions).toEqual(versionsResponse);
      });
    });

    it('should return an empty array when not given an id', function() {
      return historySrv.getHistoryList(emptyDash, historyListOpts).then(function(versions) {
        expect(versions).toEqual([]);
      });
    });

    it('should return an empty array when not given a dashboard', function() {
      return historySrv.getHistoryList(null, historyListOpts).then(function(versions) {
        expect(versions).toEqual([]);
      });
    });
  });

  describe('restoreDashboard', () => {
    it('should return a success response given valid parameters', function() {
      let version = 6;
      backendSrv.post = jest.fn(() => Promise.resolve(restoreResponse(version)));
      historySrv = new HistorySrv(backendSrv);
      return historySrv.restoreDashboard(dash, version).then(function(response) {
        expect(response).toEqual(restoreResponse(version));
      });
    });

    it('should return an empty object when not given an id', async () => {
      historySrv = new HistorySrv(backendSrv);
      let rsp = await historySrv.restoreDashboard(emptyDash, 6);
      expect(rsp).toEqual({});
    });
  });
});
