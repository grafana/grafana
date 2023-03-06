import { useAsyncFn } from 'react-use';

import { DataFrameView } from '@grafana/data';

import { loadFeed } from './feed';
import { NewsItem } from './types';
import { feedToDataFrame } from './utils';

export function useNewsFeed(url: string) {
  const [state, getNews] = useAsyncFn(
    async () => {
      const feed = await loadFeed(url);
      const frame = feedToDataFrame(feed);
      return new DataFrameView<NewsItem>(frame);
    },
    [url],
    { loading: true }
  );

  return { state, getNews };
}
