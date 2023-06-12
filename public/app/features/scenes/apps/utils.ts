import { useLocation } from 'react-router-dom';

import { UrlQueryMap, urlUtil } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';
import { QueryVariable, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

export function useAppQueryParams() {
  const location = useLocation();
  return locationSearchToObject(location.search || '');
}

export function getLinkUrlWithAppUrlState(path: string, params: UrlQueryMap): string {
  return urlUtil.renderUrl(path, params);
}

export function getInstantQuery(query: Partial<PromQuery>): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        instant: true,
        format: 'table',
        maxDataPoints: 500,
        ...query,
      },
    ],
  });
}

export function getTimeSeriesQuery(query: Partial<PromQuery>): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        range: true,
        format: 'time_series',
        maxDataPoints: 500,
        ...query,
      },
    ],
  });
}

export function getVariablesDefinitions() {
  return new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: 'instance',
        datasource: { uid: 'gdev-prometheus' },
        query: { query: 'label_values(grafana_http_request_duration_seconds_sum, instance)' },
      }),
    ],
  });
}
