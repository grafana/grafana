import { UrlQueryMap } from '@grafana/runtime';

export interface LocationState {
  url: string;
  path: string;
  //TODO[Router]: refactor to URLSearchParams
  query: UrlQueryMap;
  //TODO[Router]: refactor to URLSearchParams
  routeParams: UrlQueryMap;
  replace: boolean;
  lastUpdated: number;
}
