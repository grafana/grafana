import React, { FC } from 'react';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { PluginPageRouter, PluginPageRouteProps, PluginPageRouterProps, UrlQueryMap } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

export const NotFound: FC<PluginPageRouteProps> = () => {
  return <h2>Not route matched and no default route found</h2>;
};

export interface ConnectedProps {
  path: string;
  page?: string | null;
  query: UrlQueryMap;
}

export type RouterProps = PluginPageRouterProps & ConnectedProps;

export const Router: FC<RouterProps> = ({ children, page }) => {
  let defaultRoute: React.ReactNode = NotFound;

  const fullPagePath = `/${page}`;

  for (const child of React.Children.toArray(children) as any) {
    console.log('child', child);
    if (!child) {
      continue;
    }

    if (child.props.path === fullPagePath) {
      return child;
    }

    if (child.props.path === '/') {
      defaultRoute = child;
    }
  }

  return defaultRoute;
};

const Route: FC<PluginPageRouteProps> = ({ component }) => {
  return React.createElement(component);
};

const mapStateToProps: MapStateToProps<ConnectedProps, PluginPageRouterProps, StoreState> = (state, props) => ({
  query: state.location.query,
  path: state.location.path,
  page: state.location.routeParams.page as string,
});

PluginPageRouter.Router = connect(mapStateToProps)(Router);
PluginPageRouter.Route = Route;
