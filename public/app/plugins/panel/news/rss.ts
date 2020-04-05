import { RssFeed, RssItem } from './types';

export async function loadRSSFeed(url: string): Promise<RssFeed> {
  const rsp = await fetch(url);
  const txt = await rsp.text();
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(txt, 'text/xml');
  const feed: RssFeed = {
    items: [],
  };

  const getProperty = (node: Element, property: string) => {
    const propNode = node.querySelector(property);
    if (propNode) {
      return propNode.textContent ?? '';
    }
    return '';
  };

  doc.querySelectorAll('item').forEach(node => {
    const item: RssItem = {
      title: getProperty(node, 'title'),
      link: getProperty(node, 'link'),
      content: getProperty(node, 'description'),
      pubDate: getProperty(node, 'pubDate'),
    };

    feed.items.push(item);
  });

  return feed;
}
