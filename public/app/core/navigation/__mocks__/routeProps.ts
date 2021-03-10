import { GrafanaRouteComponentProps } from '../types';
import { createMemoryHistory } from 'history';
import { merge } from 'lodash';

export function getRouteComponentProps<T = {}, Q extends Record<string, string | null | undefined> = {}>(
  overrides: Partial<GrafanaRouteComponentProps> = {}
): GrafanaRouteComponentProps<T, Q> {
  const defaults: GrafanaRouteComponentProps<T, Q> = {
    history: createMemoryHistory(),
    location: {
      search: '',
    } as any,
    match: { params: {} } as any,
    route: {} as any,
    queryParams: {} as any,
  };

  return merge(overrides, defaults);
}
