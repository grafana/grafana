import fs from 'fs';

import { parseRSSFeed } from './rss';

describe('RSS feed parser', () => {
  it('should successfully parse an rss feed', async () => {
    const rssFile = fs.readFileSync(`${__dirname}/fixtures/rss.xml`, 'utf8');
    const parsedFeed = parseRSSFeed(rssFile);
    expect(parsedFeed.items).toHaveLength(1);
    expect(parsedFeed.items[0].title).toBe('A fake item');
    expect(parsedFeed.items[0].link).toBe('https://www.example.net/2022/02/10/something-fake/');
    expect(parsedFeed.items[0].pubDate).toBe('Thu, 10 Feb 2022 16:00:17 +0000');
    expect(parsedFeed.items[0].content).toBe('A description of a fake blog post');
  });
});
