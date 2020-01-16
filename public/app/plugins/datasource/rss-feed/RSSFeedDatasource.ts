// Types
import { DataQueryRequest, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

import { RSSFeedOptions, RSSFeedQuery } from './types';

import { feedToDataFrame } from './utils';
import { loadRSSFeed } from './rss';

export class RSSFeedDatasource extends DataSourceApi<RSSFeedQuery, RSSFeedOptions> {
  feedUrl = 'https://grafana.com/blog/index.xml';
  proxyUrl = '';

  constructor(instanceSettings: DataSourceInstanceSettings<RSSFeedOptions>) {
    super(instanceSettings);

    if (instanceSettings.jsonData.feedUrl) {
      this.feedUrl = instanceSettings.jsonData.feedUrl;
      this.proxyUrl = instanceSettings.jsonData.proxyUrl;
    }
  }

  async loadFeed() {
    try {
      const url = `${this.proxyUrl}${this.feedUrl}`;
      const res = await loadRSSFeed(url);
      const frame = feedToDataFrame(res);
      return frame;
    } catch (err) {
      console.error('Error Loading News', err);
      throw err;
    }
  }

  async query(options: DataQueryRequest<RSSFeedQuery>) {
    const feed = await this.loadFeed();
    return {
      data: [feed],
    };
  }

  testDatasource() {
    // TODO
    return new Promise((resolve, reject) => {
      resolve({
        status: 'success',
        message: 'yay',
      });
    });
  }
}
export default RSSFeedDatasource;
