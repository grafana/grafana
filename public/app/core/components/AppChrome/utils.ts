import { ArrayVector, FieldType, DataFrame, dateTime } from '@grafana/data';

import { Feed } from './types';

function getProperty(node: Element, property: string): string {
  const propNode = node.querySelector(property);
  return propNode?.textContent ?? '';
}

export function parseRSSFeed(txt: string): Feed {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(txt, 'text/xml');

  const feed: Feed = {
    items: Array.from(doc.querySelectorAll('item')).map((node) => ({
      title: getProperty(node, 'title'),
      link: getProperty(node, 'link'),
      content: getProperty(node, 'description'),
      pubDate: getProperty(node, 'pubDate'),
      ogImage: node.querySelector("meta[property='og:image']")?.getAttribute('content'),
    })),
  };

  return feed;
}

export function feedToDataFrame(feed: Feed): DataFrame {
  const date = new ArrayVector<number>([]);
  const title = new ArrayVector<string>([]);
  const link = new ArrayVector<string>([]);
  const content = new ArrayVector<string>([]);
  const ogImage = new ArrayVector<string | undefined | null>([]);

  for (const item of feed.items) {
    const val = dateTime(item.pubDate);

    try {
      date.buffer.push(val.valueOf());
      title.buffer.push(item.title);
      link.buffer.push(item.link);
      ogImage.buffer.push(item.ogImage);

      if (item.content) {
        const body = item.content.replace(/<\/?[^>]+(>|$)/g, '');
        content.buffer.push(body);
      }
    } catch (err) {
      console.warn('Error reading news item:', err, item);
    }
  }

  return {
    fields: [
      { name: 'date', type: FieldType.time, config: { displayName: 'Date' }, values: date },
      { name: 'title', type: FieldType.string, config: {}, values: title },
      { name: 'link', type: FieldType.string, config: {}, values: link },
      { name: 'content', type: FieldType.string, config: {}, values: content },
      { name: 'ogImage', type: FieldType.string, config: {}, values: ogImage },
    ],
    length: date.length,
  };
}
