import { NavModelItem } from '@grafana/data';
export const TOP_BAR_LEVEL_HEIGHT = 40;

export interface ToolbarUpdateProps {
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}

export interface NewsItem {
  date: number;
  title: string;
  link: string;
  content: string;
  ogImage?: string | null;
}

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
