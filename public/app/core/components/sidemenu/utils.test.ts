import { updateConfig } from '../../config';
import { getForcedLoginUrl } from './utils';

const url = '/whatever?a=1&b=2';

describe('getForcedLoginUrl', () => {
  it.each`
    appSubUrl          | expected
    ${''}              | ${'/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana'}      | ${'/grafana/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana/test'} | ${'/grafana/test/whatever?a=1&b=2&forceLogin=true'}
  `(
    "when appUrl set to '$appUrl' and appSubUrl set to '$appSubUrl' then result should be '$expected'",
    ({ appSubUrl, expected }) => {
      updateConfig({
        appSubUrl,
      });

      const result = getForcedLoginUrl(url);

      expect(result).toBe(expected);
    }
  );
});
