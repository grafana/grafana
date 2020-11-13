import { RssFeed, RssItem } from './types';

export async function loadRSSFeed(url: string): Promise<RssFeed> {
  const rsp = await fetch(url);
  const txt = await rsp.text();
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(txt, 'text/xml');
  const feed: RssFeed = {
    items: [],
  };

  // regex and url for handling feeds with relative paths in <item> <link>
  const r = new RegExp('^(?:[a-z]+:)?//', 'i');
  const base_url = new URL(url).protocol + new URL(url).host;

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
      link: r.test(getProperty(node, 'link')) ? getProperty(node, 'link') : base_url + getProperty(node, 'link'),
      content: getProperty(node, 'description'),
      pubDate: getProperty(node, 'pubDate'),
    };

    feed.items.push(item);
  });

  return feed;
}
