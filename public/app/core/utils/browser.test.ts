import { checkBrowserCompatibility } from './browser';

const setUserAgentString = (userAgentString: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgentString,
    configurable: true,
  });
};

describe('browser', () => {
  describe('check compatibility', () => {
    it('should be true for chrome version 77', () => {
      setUserAgentString(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 Safari/537.36'
      );
      expect(checkBrowserCompatibility()).toBeTruthy();
    });

    it('should be false for IE 11', () => {
      setUserAgentString('Mozilla/5.0 (compatible, MSIE 11, Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko');

      expect(checkBrowserCompatibility()).toBeFalsy();
    });
  });
});
