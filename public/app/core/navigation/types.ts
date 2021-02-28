import React from 'react';
import { RouteComponentProps } from 'react-router-dom';

export interface GrafanaRouteComponentProps<T = any> extends RouteComponentProps<T> {
  $injector: any;
  routeName?: string;
}

export type GrafanaRouteComponent<T = any> = React.ComponentType<GrafanaRouteComponentProps<T>>;

export interface GrafanaRouteProps<T, Q = any> extends RouteComponentProps<T> {
  component: GrafanaRouteComponent<T>;
  route: RouteDescriptor;
  $injector: any; // TODO[Router]: annotate correctly
}

export interface RouteDescriptor {
  path: string;
  component: GrafanaRouteComponent<any>;
  roles?: () => string[];
  pageClass?: string;
  routeName?: string;
}
