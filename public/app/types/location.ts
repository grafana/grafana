import { UrlQueryMap } from '@grafana/runtime';

export interface LocationState {
  url: string;
  path: string;
  query: UrlQueryMap;
  routeParams: UrlQueryMap;
  replace: boolean;
  lastUpdated: number;
}
