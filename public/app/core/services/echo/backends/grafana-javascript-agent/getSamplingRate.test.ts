import { config } from '@grafana/runtime';

import { getSamplingRate } from './getSamplingRate';

describe('getSamplingRate', () => {
  beforeEach(() => {
    config.featureToggles.filterOutBotsFromFrontendLogs = false;
  });

  it('should return 1 when feature toggle is disabled', () => {
    const botUserAgent = 'Googlebot/2.1 (+http://www.google.com/bot.html)';
    expect(getSamplingRate(botUserAgent)).toBe(1);
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
    expect(getSamplingRate(userAgent)).toBe(0);
  });

  it('should return 1 for regular user agents', () => {
    config.featureToggles.filterOutBotsFromFrontendLogs = true;
    const regularUserAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
    expect(getSamplingRate(regularUserAgent)).toBe(1);
  });

  it.each(['', null, undefined])('should return 1 when user agent is %s', (userAgent) => {
    config.featureToggles.filterOutBotsFromFrontendLogs = true;
    expect(getSamplingRate(userAgent)).toBe(1);
  });
});
