import { ArrayVector, FieldType, DataFrame, dateTime } from '@grafana/data';

import { Feed } from './types';

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
