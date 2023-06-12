import { createMemoryHistory } from 'history';
import { merge } from 'lodash';

import { GrafanaRouteComponentProps } from '../types';

export function getRouteComponentProps<T extends {} = {}, Q extends Record<string, string | null | undefined> = {}>(
  overrides: Partial<GrafanaRouteComponentProps> = {}
): GrafanaRouteComponentProps<T, Q> {
  const defaults: GrafanaRouteComponentProps<T, Q> = {
    history: createMemoryHistory(),
    location: {
      hash: '',
      pathname: '',
      state: {},
      search: '',
    },
    match: { params: {} } as any,
    route: {
      path: '',
      component: () => null,
    },
    queryParams: {} as any,
  };

  return merge(overrides, defaults);
}
