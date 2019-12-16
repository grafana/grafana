export interface NewsOptions {
  feedUrl: string;
}

export const defaults: NewsOptions = {
  feedUrl: 'https://grafana.com/blog/index.xml',
};

export interface RssFeed {
  description: string;
  image: string;
  items: RssItem[];
  title: string;
  url: string;
}

export interface RssItem {
  created: number;
  description: string;
  link: string;
  title: string;
  url: string;
}
