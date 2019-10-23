import { checkBrowserCompatibility } from './browser';

const setUserAgentString = (userAgentString: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgentString,
    configurable: true,
  });
};

const setVendor = (vendor: string) => {
  Object.defineProperty(window.navigator, 'vendor', {
    value: vendor,
    configurable: true,
  });
};

describe('browser', () => {
  describe('check compatibility', () => {
    describe('Chrome', () => {
      it('should be true for chrome version 77', () => {
        setUserAgentString(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 Safari/537.36'
        );
        setVendor('Google Inc.');

        expect(checkBrowserCompatibility()).toBeTruthy();
      });

      it('should be false for chrome version <= 54', () => {
        setUserAgentString(
          'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.71 Safari/537.36'
        );
        setVendor('Google Inc.');

        expect(checkBrowserCompatibility()).toBeFalsy();
      });
    });
    describe('IE', () => {
      it('should be false for IE 11', () => {
        setUserAgentString('Mozilla/5.0 (compatible, MSIE 11, Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko');
        setVendor('Microsoft');

        expect(checkBrowserCompatibility()).toBeFalsy();
      });
    });
    describe('Edge', () => {
      it('should be false for Edge <= 16', () => {
        setUserAgentString(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393'
        );
        setVendor('Microsoft');

        expect(checkBrowserCompatibility()).toBeFalsy();
      });

      it('should be true for Edge version 44', () => {
        setUserAgentString(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 Safari/537.36 Edg/44.18362.387.0'
        );
        setVendor('Microsoft');

        expect(checkBrowserCompatibility()).toBeTruthy();
      });
    });
    describe('Firefox', () => {
      it('should be true for version 69', () => {
        setUserAgentString('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/69.0');
        setVendor('Firefox');

        expect(checkBrowserCompatibility()).toBeTruthy();
      });
    });
  });
});
