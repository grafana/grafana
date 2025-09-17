import { TransportItem, TransportItemType } from '@grafana/faro-core';
import { config } from '@grafana/runtime';

import { beforeSendHandler } from './beforeSendHandler';

const getTransportationItem = (userAgent: string | undefined): TransportItem => ({
  meta: { browser: { userAgent } },
  payload: {},
  type: TransportItemType.LOG,
});

describe('beforeSendHandler', () => {
  beforeEach(() => {
    config.featureToggles.filterOutBotsFromFrontendLogs = false;
  });

  it('should return item when feature toggle is disabled', () => {
    const botUserAgent = 'Googlebot/2.1 (+http://www.google.com/bot.html)';
    const item = getTransportationItem(botUserAgent);
    expect(beforeSendHandler(item)).toBe(item);
  });

  it('should return item for regular user agents', () => {
    config.featureToggles.filterOutBotsFromFrontendLogs = true;
    const regularUserAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
    const item = getTransportationItem(regularUserAgent);
    expect(beforeSendHandler(item)).toBe(item);
  });

  it.each(['', undefined])('should return item when user agent is %s', (userAgent) => {
    config.featureToggles.filterOutBotsFromFrontendLogs = true;
    const item = getTransportationItem(userAgent);
    expect(beforeSendHandler(item)).toBe(item);
  });

  it.each([
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
  ])('should return 0 for bot user agent: %s', (userAgent) => {
    config.featureToggles.filterOutBotsFromFrontendLogs = true;
    const item = getTransportationItem(userAgent);
    expect(beforeSendHandler(item)).toBe(null);
  });
});
