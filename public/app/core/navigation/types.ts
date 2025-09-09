import { Location } from 'history';
import { ComponentType } from 'react';

import { UrlQueryMap } from '@grafana/data';

export interface GrafanaRouteComponentProps<T extends {} = {}, Q = UrlQueryMap> {
  route: RouteDescriptor;
  queryParams: Q;
  location: Location;
}

export type GrafanaRouteComponent<T extends {} = any> = ComponentType<GrafanaRouteComponentProps<T>>;

export interface RouteDescriptor {
  path: string;
  component: GrafanaRouteComponent;
  roles?: () => string[];
  pageClass?: string;
  /** Can be used like an id for the route if the same component is used by many routes */
  routeName?: string;
  chromeless?: boolean;
  sensitive?: boolean;

  /**
   * Allow the route to be access by anonymous users.
   * Currently only used when using the frontend-service.
   */
  allowAnonymous?: boolean;
}
