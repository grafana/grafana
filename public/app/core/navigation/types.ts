import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { ContextSrv } from '../services/context_srv';

export interface GrafanaRouteProps<T, Q = any> extends RouteComponentProps<T> {
  component: React.ComponentType<GrafanaRouteComponentProps<T>>;
  route: RouteDescriptor;
  $injector: any; // TODO[Router]: annotate correctly
  $contextSrv: ContextSrv;
}

type GrafanaRouteComponentProps<T> = Omit<GrafanaRouteProps<T>, 'component' | 'route'> & {
  routeInfo?: string;
};

export interface RouteDescriptor {
  path: string;
  reloadOnSearch?: boolean;
  component: React.ComponentType<GrafanaRouteComponentProps<any>>;
  redirectTo?: string;
  roles?: () => string[];
  pageClass?: string;
  routeInfo?: string;
}
