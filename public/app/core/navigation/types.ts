import React from 'react';
import { RouteComponentProps } from 'react-router-dom';

import { UrlQueryMap } from '@grafana/data';

export interface GrafanaRouteComponentProps<T extends {} = {}, Q = UrlQueryMap> extends RouteComponentProps<T> {
  route: RouteDescriptor;
  queryParams: Q;
}

export type GrafanaRouteComponent<T extends {} = any> = React.ComponentType<GrafanaRouteComponentProps<T>>;

export interface RouteDescriptor {
  path: string;
  component: GrafanaRouteComponent;
  roles?: () => string[];
  pageClass?: string;
  /** Can be used like an id for the route if the same component is used by many routes */
  routeName?: string;
  chromeless?: boolean;
  exact?: boolean;
  sensitive?: boolean;
}
