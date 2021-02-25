import React from 'react';
import { GrafanaRouteProps } from './types';
import { navigationLogger } from './utils';

export class GrafanaRoute extends React.Component<GrafanaRouteProps<any>> {
  componentDidMount() {
    navigationLogger('GrafanaRoute', false, 'Mounted', this.props.match);
    this.getPageClasses().forEach((c) => document.body.classList.add(c));
  }

  componentDidUpdate(prevProps: GrafanaRouteProps<any>) {
    navigationLogger('GrafanaRoute', false, 'Updated', this.props, prevProps);
  }

  componentWillUnmount() {
    navigationLogger('GrafanaRoute', false, 'Unmount', this.props.route.routeInfo);
    this.getPageClasses().forEach((c) => document.body.classList.remove(c));
  }

  shouldComponentUpdate(nextProps: GrafanaRouteProps<any>) {
    // Most of the pages rely on state.location rather than router/history location. We don't want these pages
    // to re-render as they will be updated based on the Redux state changes.
    if (nextProps.route.reloadOnSearch && nextProps.location.search !== this.props.location.search) {
      return true;
    }

    return false;
  }

  getPageClasses() {
    return this.props.route.pageClass ? this.props.route.pageClass.split(' ') : [];
  }

  render() {
    const { component, route, ...routeComponentProps } = this.props;

    return React.createElement(component, {
      ...routeComponentProps,
      routeInfo: route.routeInfo,
    });
  }
}
