import { locationUtil } from './location';

describe('locationUtil', () => {
  beforeAll(() => {
    locationUtil.initialize({
      getConfig: () => {
        return { appSubUrl: '/subUrl' } as any;
      },
      // @ts-ignore
      buildParamsFromVariables: () => {},
      // @ts-ignore
      getTimeRangeForUrl: () => {},
    });
  });
  describe('With /subUrl as appSubUrl', () => {
    it('/subUrl should be stripped', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/grafana/');
    });
  });
});
