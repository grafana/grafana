import React from 'react';
import { useDispatch } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
// @ts-ignore
import Drop from 'tether-drop';
import { GrafanaRouteComponentProps } from './types';
import { updateLocation } from '../reducers/location';
import usePrevious from 'react-use/lib/usePrevious';
import { navigationLogger, queryStringToJSON } from '@grafana/runtime';

export interface Props extends GrafanaRouteComponentProps {}

export class GrafanaRoute extends React.Component<Props> {
  componentDidMount() {
    this.updateBodyClassNames();
    this.cleanupDOM();
    navigationLogger('GrafanaRoute', false, 'Mounted', this.props.match);
  }

  componentDidUpdate(prevProps: Props) {
    this.cleanupDOM();
    navigationLogger('GrafanaRoute', false, 'Updated', this.props, prevProps);
  }

  componentWillUnmount() {
    this.updateBodyClassNames(true);
    navigationLogger('GrafanaRoute', false, 'Unmounted', this.props.route);
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
    const { props } = this;
    navigationLogger('GrafanaRoute', false, 'Rendered', props.route);

    const RouteComponent = props.route.component;

    return <RouteComponent {...props} />;
  }
}

export const SyncLocationWithRedux: React.FC<RouteComponentProps<any>> = (props) => {
  const dispatch = useDispatch();
  const prevProps = usePrevious(props);
  navigationLogger('GrafanaRoute', false, 'Sync location with redux');

  if (!prevProps || prevProps.match !== props.match || prevProps.location !== props.location) {
    // The dispatch happens during the render. At first sight this looks like a bad practice, but mind that
    // this component is ONLY rendered on route change making it a perfect place too sync the locationmatch  with Redux.
    // Thanks to this the page component should have correct location state already available in Redux.
    dispatch(
      updateLocation({
        path: props.location.pathname,
        routeParams: props.match.params,
        query: queryStringToJSON(props.location.search),
      })
    );
  }

  return <>{props.children}</>;
};
