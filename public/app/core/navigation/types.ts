import React from 'react';
import { RouteComponentProps } from 'react-router-dom';

export interface GrafanaRouteProps<T, Q = any> extends RouteComponentProps<T> {
  component: () => React.ComponentType<ContainerProps<T>>;
  route: RouteDescriptor;
  $injector: any; // TODO[Router]: annotate correctly
}

interface ContainerProps<T> extends RouteComponentProps<T> {
  $injector: any;
  routeName?: string;
}

export interface RouteDescriptor {
  path: string;
  component: () => React.ComponentType<ContainerProps<any>>;
  reloadOnSearch?: boolean;
  roles?: () => string[];
  pageClass?: string;
  routeName?: string;
}
