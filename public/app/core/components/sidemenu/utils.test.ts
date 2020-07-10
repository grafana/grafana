import { updateConfig } from '../../config';
import { getForcedLoginUrl } from './utils';

const url = '/whatever?a=1&b=2';

describe('getForcedLoginUrl', () => {
  it.each`
    appUrl                                     | appSubUrl     | expected
    ${'http://server.onmydomain.com/grafana/'} | ${'/grafana'} | ${'http://server.onmydomain.com/grafana/whatever?a=1&b=2&forceLogin=true'}
    ${'http://server.onmydomain.com/'}         | ${''}         | ${'http://server.onmydomain.com/whatever?a=1&b=2&forceLogin=true'}
    ${'http://localhost:3000/'}                | ${''}         | ${'http://localhost:3000/whatever?a=1&b=2&forceLogin=true'}
  `(
    "when appUrl set to '$appUrl' and appSubUrl set to '$appSubUrl' then result should be '$expected'",
    ({ appUrl, appSubUrl, expected }) => {
      updateConfig({
        appUrl,
        appSubUrl,
      });

      const result = getForcedLoginUrl(url);

      expect(result).toBe(expected);
    }
  );
});
