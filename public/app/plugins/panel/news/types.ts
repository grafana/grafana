export interface NewsItem {
  date: number;
  title: string;
  link: string;
  content: string;
  ogImage?: string | null;
}

/**
 * Helper interface for feed parser
 */
export interface Feed {
  title?: string;
  description?: string;
  items: FeedItem[];
}

export interface FeedItem {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  ogImage?: string | null;
}
