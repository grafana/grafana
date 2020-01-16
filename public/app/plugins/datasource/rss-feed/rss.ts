import { RssFeed, RssItem } from './types';

export async function loadRSSFeed(url: string): Promise<RssFeed> {
  const rsp = await fetch(url);
  const txt = await rsp.text();
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(txt, 'text/xml');
  const feed: RssFeed = {
    items: [],
  };

  doc.querySelectorAll('item').forEach(node => {
    const item: RssItem = {
      title: node.querySelector('title').textContent,
      link: node.querySelector('link').textContent,
      content: node.querySelector('description').textContent,
      pubDate: node.querySelector('pubDate').textContent,
    };

    feed.items.push(item);
  });

  return feed;
}
