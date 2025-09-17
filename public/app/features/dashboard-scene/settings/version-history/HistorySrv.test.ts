import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';

import { HistorySrv } from './HistorySrv';
import { restore, versions } from './mocks/dashboardHistoryMocks';

const getMock = jest.fn().mockResolvedValue({});
const postMock = jest.fn().mockResolvedValue({});

jest.mock('app/core/store', () => ({
  get: jest.fn(),
  getObject: jest.fn((_a, b) => b),
}));

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

  const dash = createDashboardModelFixture({ uid: '_U4zObQMz' });
  const emptyDash = createDashboardModelFixture();
  const historyListOpts = { limit: 10, start: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHistoryList', () => {
    it('should return a versions array for the given dashboard id', () => {
      getMock.mockImplementation(() => Promise.resolve(versionsResponse));
      historySrv = new HistorySrv();

      return historySrv.getHistoryList(dash.uid, historyListOpts).then((versions) => {
        expect(versions).toEqual(versionsResponse);
      });
    });

    it('should return an empty array when not given an id', () => {
      return historySrv.getHistoryList(emptyDash.uid, historyListOpts).then((versions) => {
        expect(versions).toEqual([]);
      });
    });

    it('should return an empty array when not given a dashboard id', () => {
      return historySrv.getHistoryList(null as unknown as string, historyListOpts).then((versions) => {
        expect(versions).toEqual([]);
      });
    });
  });

  describe('getDashboardVersion', () => {
    it('should return a version object for the given dashboard id and version', () => {
      getMock.mockImplementation(() => Promise.resolve(versionsResponse.versions[0]));
      historySrv = new HistorySrv();

      return historySrv.getDashboardVersion(dash.uid, 4).then((version) => {
        expect(version).toEqual(versionsResponse.versions[0]);
      });
    });

    it('should return an empty object when not given an id', async () => {
      historySrv = new HistorySrv();

      const rsp = await historySrv.getDashboardVersion(emptyDash.uid, 6);
      expect(rsp).toEqual({});
    });
  });

  describe('restoreDashboard', () => {
    it('should return a success response given valid parameters', () => {
      const version = 6;
      postMock.mockImplementation(() => Promise.resolve(restoreResponse(version)));
      historySrv = new HistorySrv();
      return historySrv.restoreDashboard(dash.uid, version).then((response) => {
        expect(response).toEqual(restoreResponse(version));
      });
    });

    it('should return an empty object when not given an id', async () => {
      historySrv = new HistorySrv();
      const rsp = await historySrv.restoreDashboard(emptyDash.uid, 6);
      expect(rsp).toEqual({});
    });
  });
});
