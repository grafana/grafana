import { locationUtil } from './location';

describe('locationUtil', () => {
  beforeAll(() => {
    locationUtil.initialize({
      config: { appSubUrl: '/subUrl' } as any,
      getVariablesUrlParams: (() => {}) as any,
      getTimeRangeForUrl: (() => {}) as any,
    });
  });

  describe('With /subUrl as appSubUrl', () => {
    it('/subUrl should be stripped', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/grafana/');
    });
  });
});
