import { versions, restore } from './__mocks__/history';
import { HistorySrv } from './HistorySrv';
import { DashboardModel } from '../../state/DashboardModel';
jest.mock('app/core/store');

describe('historySrv', () => {
  const versionsResponse = versions();
  const restoreResponse = restore;

  const backendSrv: any = {
    get: jest.fn(() => Promise.resolve({})),
    post: jest.fn(() => Promise.resolve({})),
  };

  let historySrv = new HistorySrv(backendSrv);

  const dash = new DashboardModel({ id: 1 });
  const emptyDash = new DashboardModel({});
  const historyListOpts = { limit: 10, start: 0 };

  describe('getHistoryList', () => {
    it('should return a versions array for the given dashboard id', () => {
      backendSrv.get = jest.fn(() => Promise.resolve(versionsResponse));
      historySrv = new HistorySrv(backendSrv);

      return historySrv.getHistoryList(dash, historyListOpts).then((versions: any) => {
        expect(versions).toEqual(versionsResponse);
      });
    });

    it('should return an empty array when not given an id', () => {
      return historySrv.getHistoryList(emptyDash, historyListOpts).then((versions: any) => {
        expect(versions).toEqual([]);
      });
    });

    it('should return an empty array when not given a dashboard', () => {
      return historySrv.getHistoryList(null, historyListOpts).then((versions: any) => {
        expect(versions).toEqual([]);
      });
    });
  });

  describe('restoreDashboard', () => {
    it('should return a success response given valid parameters', () => {
      const version = 6;
      backendSrv.post = jest.fn(() => Promise.resolve(restoreResponse(version)));
      historySrv = new HistorySrv(backendSrv);
      return historySrv.restoreDashboard(dash, version).then((response: any) => {
        expect(response).toEqual(restoreResponse(version));
      });
    });

    it('should return an empty object when not given an id', async () => {
      historySrv = new HistorySrv(backendSrv);
      const rsp = await historySrv.restoreDashboard(emptyDash, 6);
      expect(rsp).toEqual({});
    });
  });
});
