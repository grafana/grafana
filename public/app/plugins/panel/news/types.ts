export interface NewsItem {
  date: number;
  title: string;
  link: string;
  content: string;
  ogImage?: string | null;
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
  ogImage?: string | null;
}
