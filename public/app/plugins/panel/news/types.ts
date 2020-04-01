export const DEFAULT_FEED_URL = 'https://grafana.com/blog/news.xml';

export interface NewsOptions {
  feedUrl?: string;
}

export const defaults: NewsOptions = {
  // will default to grafana blog
};

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
