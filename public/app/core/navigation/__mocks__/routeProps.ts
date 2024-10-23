import { merge } from 'lodash';

import { GrafanaRouteComponentProps } from '../types';

export function getRouteComponentProps<T extends {} = {}, Q extends Record<string, string | null | undefined> = {}>(
  overrides: Partial<GrafanaRouteComponentProps> = {}
): GrafanaRouteComponentProps<T, Q> {
  const defaults: GrafanaRouteComponentProps<T, Q> = {
    location: {
      hash: '',
      pathname: '',
      state: {},
      search: '',
    },
    route: {
      path: '',
      component: () => null,
    },
    queryParams: {} as Q,
  };

  return merge(overrides, defaults);
}
