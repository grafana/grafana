import { RssFeed } from './types';
import { DataFrame, ArrayVector, FieldType } from '@grafana/data';

export function feedToDataFrame(feed: RssFeed): DataFrame {
  const titles = new ArrayVector<string>([]);
  const links = new ArrayVector<string>([]);
  const descr = new ArrayVector<string>([]);

  for (const item of feed.items) {
    titles.buffer.push(item.title);
    links.buffer.push(item.link);
    descr.buffer.push(item.description);
  }

  return {
    fields: [
      { name: 'title', type: FieldType.string, config: {}, values: titles },
      { name: 'link', type: FieldType.string, config: {}, values: links },
      { name: 'description', type: FieldType.string, config: {}, values: descr },
    ],
    length: titles.length,
  };
}
