import { DataFrameView } from '@grafana/data';

import { NEWS_FEED } from './constants';
import { NewsItem } from './types';
import { parseRSSFeed, feedToDataFrame } from './utils';

export const fetchNews = async () => {
  const rsp = await fetch(NEWS_FEED);
  const txt = await rsp.text();
  const feed = parseRSSFeed(txt);
  const frame = feedToDataFrame(feed);

  return new DataFrameView<NewsItem>(frame);
};
