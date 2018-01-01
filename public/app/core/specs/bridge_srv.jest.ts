import { BridgeSrv } from 'app/core/services/bridge_srv';

jest.mock('app/core/config', () => {
  return {
    appSubUrl: '/subUrl',
  };
});

describe('BridgeSrv', () => {
  let searchSrv;

  beforeEach(() => {
    searchSrv = new BridgeSrv(null, null, null, null);
  });

  describe('With /subUrl as appSubUrl', () => {
    it('/subUrl should be stripped', () => {
      const urlWithoutMaster = searchSrv.stripBaseFromUrl('/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/grafana/');
    });
  });
});
