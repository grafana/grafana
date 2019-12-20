import RssParser from 'rss-parser';
import { RssFeed } from './types';

const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

export async function loadRSSFeed(feedUrl: string, proxy?: boolean): Promise<RssFeed> {
  const parser = new RssParser();
  const url = proxy ? CORS_PROXY + feedUrl : feedUrl;
  return (await parser.parseURL(url)) as RssFeed;
}
