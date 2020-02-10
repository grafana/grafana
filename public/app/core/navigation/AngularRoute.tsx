import * as React from 'react';
import { Route } from 'react-router-dom';
import NgController from './NgController';
import { RouteDescriptor } from '../../routes/routes';

interface AngularRouteProps extends RouteDescriptor {
  injector: {};
  mountContainer: HTMLElement;
}

class AngularRoute extends React.Component<AngularRouteProps> {
  render() {
    const {
      templateUrl,
      controller,
      controllerAs,
      reloadOnSearch,
      pageClass,
      mountContainer,
      injector,
      routeInfo,
      path,
      ...otherProps
    } = this.props;

    return (
      <Route
        exact
        path={path}
        render={routeProps => {
          return (
            <NgController
              injector={injector}
              mountContainer={mountContainer}
              controller={controller}
              controllerAs={controllerAs}
              templateUrl={templateUrl}
              routeInfo={routeInfo}
              pageClass={pageClass}
              reloadOnSearch={reloadOnSearch}
              path={path}
              {...routeProps}
            />
          );
        }}
        {...otherProps}
      />
    );
  }
}

export default AngularRoute;
