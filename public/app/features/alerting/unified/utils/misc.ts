import { config } from '@grafana/runtime';
import { urlUtil } from '@grafana/data';

export function createExploreLink(dataSourceName: string, query: string) {
  return urlUtil.renderUrl(config.appSubUrl + '/explore', {
    left: JSON.stringify([
      'now-1h',
      'now',
      dataSourceName,
      { datasource: dataSourceName, expr: query },
      { ui: [true, true, true, 'none'] },
    ]),
  });
}
