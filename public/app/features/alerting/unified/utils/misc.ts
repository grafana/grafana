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

// used to hash rules
export function hash(value: string): number {
  let hash = 0;
  if (value.length === 0) {
    return hash;
  }
  for (var i = 0; i < value.length; i++) {
    var char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
