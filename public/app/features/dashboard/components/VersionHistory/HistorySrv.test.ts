import { restore, versions } from './__mocks__/history';
import { HistorySrv } from './HistorySrv';
import { DashboardModel } from '../../state/DashboardModel';

const getMock = jest.fn().mockResolvedValue({});
const postMock = jest.fn().mockResolvedValue({});

jest.mock('app/core/store');
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => ({
      post: postMock,
      get: getMock,
    }),
  };
});

describe('historySrv', () => {
  const versionsResponse = versions();
  const restoreResponse = restore;

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
      return historySrv.getHistoryList((null as unknown) as DashboardModel, historyListOpts).then((versions: any) => {
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
