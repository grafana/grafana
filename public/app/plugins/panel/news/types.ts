export interface NewsOptions {
  feedUrl: string;
  proxy?: boolean;
}

export const defaults: NewsOptions = {
  feedUrl: 'https://grafana.com/blog/index.xml',
  proxy: true,
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
