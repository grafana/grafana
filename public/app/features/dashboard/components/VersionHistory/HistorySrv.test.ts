import { versions, restore } from './__mocks__/history';
import { HistorySrv } from './HistorySrv';
import { DashboardModel } from '../../state/DashboardModel';
import { backendSrv } from 'app/core/services/backend_srv';
jest.mock('app/core/store');

describe('historySrv', () => {
  const versionsResponse = versions();
  const restoreResponse = restore;

  const getMock = jest.spyOn(backendSrv, 'get').mockImplementation(() => Promise.resolve({}));
  const postMock = jest.spyOn(backendSrv, 'post').mockImplementation(() => Promise.resolve({}));

  let historySrv = new HistorySrv();

  const dash = new DashboardModel({ id: 1 });
  const emptyDash = new DashboardModel({});
  const historyListOpts = { limit: 10, start: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHistoryList', () => {
    it('should return a versions array for the given dashboard id', () => {
      getMock.mockImplementation(() => Promise.resolve(versionsResponse));
      historySrv = new HistorySrv();

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
      postMock.mockImplementation(() => Promise.resolve(restoreResponse(version)));
      historySrv = new HistorySrv();
      return historySrv.restoreDashboard(dash, version).then((response: any) => {
        expect(response).toEqual(restoreResponse(version));
      });
    });

    it('should return an empty object when not given an id', async () => {
      historySrv = new HistorySrv();
      const rsp = await historySrv.restoreDashboard(emptyDash, 6);
      expect(rsp).toEqual({});
    });
  });
});
