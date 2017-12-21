import { GlobalEventSrv } from 'app/core/services/global_event_srv';
import { beforeEach } from 'test/lib/common';

jest.mock('app/core/config', () => {
  return {
    appSubUrl: '/subUrl',
  };
});

describe('GlobalEventSrv', () => {
  let searchSrv;

  beforeEach(() => {
    searchSrv = new GlobalEventSrv(null, null, null);
  });

  describe('With /subUrl as appSubUrl', () => {
    it('/subUrl should be stripped', () => {
      const urlWithoutMaster = searchSrv.stripBaseFromUrl('/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/grafana/');
    });
  });
});
