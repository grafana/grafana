import React from 'react';
import { GrafanaRouteProps } from './types';
import { navigationLogger } from './utils';
// @ts-ignore
import Drop from 'tether-drop';

export class GrafanaRoute extends React.Component<GrafanaRouteProps<any>> {
  componentDidMount() {
    navigationLogger('GrafanaRoute', false, 'Mounted', this.props.match);
    this.updateBodyClassNames();
    this.cleanupDOM();
  }

  componentDidUpdate(prevProps: GrafanaRouteProps<any>) {
    navigationLogger('GrafanaRoute', false, 'Updated', this.props, prevProps);
    this.cleanupDOM();
  }

  componentWillUnmount() {
    navigationLogger('GrafanaRoute', false, 'Unmount', this.props.route);
    this.updateBodyClassNames(true);
  }

  shouldComponentUpdate(nextProps: GrafanaRouteProps<any>) {
    // Most of the pages rely on state.location rather than router/history location. We don't want these pages
    // to re-render as they will be updated based on the Redux state changes.
    if (nextProps.route.reloadOnSearch && nextProps.location.search !== this.props.location.search) {
      return true;
    }
    navigationLogger('GrafanaRoute', false, 'skipping page update');
    return false;
  }

  getPageClasses() {
    return this.props.route.pageClass ? this.props.route.pageClass.split(' ') : [];
  }

  updateBodyClassNames(clear = false) {
    this.getPageClasses().forEach((c) => {
      if (clear) {
        document.body.classList.remove(c);
      }
      document.body.classList.add(c);
    });
  }

  cleanupDOM() {
    document.body.classList.remove('sidemenu-open--xs');

    // cleanup tooltips
    const tooltipById = document.getElementById('tooltip');
    tooltipById?.parentElement?.removeChild(tooltipById);

    const tooltipsByClass = document.querySelectorAll('.tooltip');
    for (let i = 0; i < tooltipsByClass.length; i++) {
      const tooltip = tooltipsByClass[i];
      tooltip.parentElement?.removeChild(tooltip);
    }

    // cleanup tether-drop
    for (const drop of Drop.drops) {
      drop.destroy();
    }
  }

  render() {
    const { component, route, ...routeComponentProps } = this.props;

    return React.createElement(component(), {
      ...routeComponentProps,
      routeInfo: route.routeInfo,
    });
  }
}
