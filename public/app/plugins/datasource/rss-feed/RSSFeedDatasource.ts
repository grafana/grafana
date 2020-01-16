// Types
import { DataQueryRequest, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

import { RSSFeedOptions, RSSFeedQuery } from './types';

export class RSSFeedDatasource extends DataSourceApi<RSSFeedQuery, RSSFeedOptions> {
  feedUrl = 'https://grafana.com/blog/index.xml';

  constructor(instanceSettings: DataSourceInstanceSettings<RSSFeedOptions>) {
    super(instanceSettings);

    if (instanceSettings.jsonData.feedUrl) {
      this.feedUrl = instanceSettings.jsonData.feedUrl;
    }
  }

  query(options: DataQueryRequest<RSSFeedQuery>): Promise<DataQueryResponse> {
    return Promise.resolve({ data: [] });
  }

  testDatasource() {
    console.log(this.feedUrl);
    return new Promise((resolve, reject) => {
      resolve({
        status: 'success',
        message: 'yay',
      });
    });
  }
}
export default RSSFeedDatasource;
