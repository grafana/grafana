import { TransportItem, TransportItemType } from '@grafana/faro-core';

import { beforeSendHandler } from './beforeSendHandler';

const getTransportationItem = (userAgent: string | undefined): TransportItem => ({
  meta: { browser: { userAgent } },
  payload: {},
  type: TransportItemType.LOG,
});

describe('beforeSendHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('when botFilterEnabled is false', () => {
    it('should return item', () => {
      const botUserAgent = 'Googlebot/2.1 (+http://www.google.com/bot.html)';
      const item = getTransportationItem(botUserAgent);
      expect(beforeSendHandler(false, item)).toBe(item);
    });
  });

  describe('when botFilterEnabled is true', () => {
    const userUserAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    ];
    const invalidUserAgents = ['', ' ', undefined, null, 0, 1, {}, [], () => {}];
    const maliciousUserAgents = userUserAgents.map((ua) => ua + 'a'.repeat(600));

    it.each(userUserAgents)('should return item for bot user agent: %s', (userAgent) => {
      const item = getTransportationItem(userAgent);
      expect(beforeSendHandler(true, item)).toBe(item);
    });

    it.each([
      ...invalidUserAgents,
      ...maliciousUserAgents,
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Twitterbot/1.0',
      'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
      'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
      'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)',
      'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
      'Mozilla/5.0 (compatible; NOTgooglebot/2.1)',
      'Mozilla/5.0 (compatible; googlebotbypass/2.1)',
      'Mozilla/5.0 (compatible; notbingbot/2.0; +http://www.bing.com/notbingbot.htm)',
    ])('should return null for bot user agent: %s', (userAgent) => {
      const item = getTransportationItem(userAgent as string);
      expect(beforeSendHandler(true, item)).toBe(null);
    });
  });
});
