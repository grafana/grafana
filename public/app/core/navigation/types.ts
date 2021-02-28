import React from 'react';
import { RouteComponentProps } from 'react-router-dom';

interface GrafanaRouteComponentProps<T> extends RouteComponentProps<T> {
  $injector: any;
  routeName?: string;
}

export type GrafanaRouteComponent<T> = React.ComponentType<GrafanaRouteComponentProps<T>>;

export interface GrafanaRouteProps<T, Q = any> extends RouteComponentProps<T> {
  component: () => GrafanaRouteComponent<T>;
  route: RouteDescriptor;
  $injector: any; // TODO[Router]: annotate correctly
}

export interface RouteDescriptor {
  path: string;
  component: () => GrafanaRouteComponent<any>;
  reloadOnSearch?: boolean;
  roles?: () => string[];
  pageClass?: string;
  routeName?: string;
}
