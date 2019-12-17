export interface NewsOptions {
  feedUrl: string;
}

export const defaults: NewsOptions = {
  feedUrl: 'https://grafana.com/blog/index.xml',
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
  description: string;
  items: RssItem[];
  title: string;
}

export interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  guid: string;
  isoDate: string;
  content?: string;
  contentSnippet?: string;
}
