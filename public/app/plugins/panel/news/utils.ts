import { RssFeed } from './types';
import { ArrayVector, FieldType, DataFrame, dateTime } from '@grafana/data';

export function feedToDataFrame(feed: RssFeed): DataFrame {
  const date = new ArrayVector<number>([]);
  const title = new ArrayVector<string>([]);
  const link = new ArrayVector<string>([]);
  const content = new ArrayVector<string>([]);

  for (const item of feed.items) {
    const val = dateTime(item.pubDate);

    try {
      date.buffer.push(val.valueOf());
      title.buffer.push(item.title);
      link.buffer.push(item.link);

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
    ],
    length: date.length,
  };
}
