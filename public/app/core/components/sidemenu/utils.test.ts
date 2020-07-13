import { updateConfig } from '../../config';
import { getForcedLoginUrl } from './utils';

describe('getForcedLoginUrl', () => {
  it.each`
    appSubUrl          | url                    | expected
    ${''}              | ${'/whatever?a=1&b=2'} | ${'/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana'}      | ${'/whatever?a=1&b=2'} | ${'/grafana/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana/test'} | ${'/whatever?a=1&b=2'} | ${'/grafana/test/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana'}      | ${''}                  | ${'/grafana?forceLogin=true'}
    ${'/grafana'}      | ${'/whatever'}         | ${'/grafana/whatever?forceLogin=true'}
    ${'/grafana'}      | ${'/whatever/'}        | ${'/grafana/whatever/?forceLogin=true'}
  `(
    "when appUrl set to '$appUrl' and appSubUrl set to '$appSubUrl' then result should be '$expected'",
    ({ appSubUrl, url, expected }) => {
      updateConfig({
        appSubUrl,
      });

      const result = getForcedLoginUrl(url);

      expect(result).toBe(expected);
    }
  );
});
