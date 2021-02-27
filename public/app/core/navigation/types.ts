import React from 'react';
import { RouteComponentProps } from 'react-router-dom';

export interface GrafanaRouteProps<T, Q = any> extends RouteComponentProps<T> {
  component: () => React.ComponentType<GrafanaRouteComponentProps<T>>;
  route: RouteDescriptor;
  $injector: any; // TODO[Router]: annotate correctly
}

type GrafanaRouteComponentProps<T> = Omit<GrafanaRouteProps<T>, 'component' | 'route'> & {
  routeInfo?: string;
};

export interface RouteDescriptor {
  path: string;
  component: () => React.ComponentType<GrafanaRouteComponentProps<any>>;
  reloadOnSearch?: boolean;
  roles?: () => string[];
  pageClass?: string;
  routeInfo?: string;
}
