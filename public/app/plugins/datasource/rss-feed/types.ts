import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface RSSFeedQuery extends DataQuery {}

export interface RSSFeedOptions extends DataSourceJsonData {
  feedUrl?: string;
  proxyUrl?: string;
}

export interface NewsItem {
  date: number;
  title: string;
  link: string;
  content: string;
}

/**
 * Helper class for rss-parser
 */
export interface RssFeed {
  title?: string;
  description?: string;
  items: RssItem[];
}

export interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
}
