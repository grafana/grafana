import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { GrafanaLegacyRouteDescriptor } from './GrafanaRoute';
import jQuery from 'jquery';

interface NgControllerProps extends RouteComponentProps<any>, GrafanaLegacyRouteDescriptor {
  injector: any;
  mountContainer: HTMLElement;
}

class NgController extends React.Component<NgControllerProps, {}> {
  container: HTMLElement;
  childScope: any;
  mounted: boolean;
  ctrl: any;

  constructor(props: NgControllerProps) {
    super(props);
    this.mounted = false;
    this.updateUrl();
  }

  updateUrl() {
    const { match, location, injector } = this.props;
    const $route = injector.get('$route');
    debugger;

    $route.updateRoute(match, location);
  }

  componentDidUpdate(prevProps: NgControllerProps) {
    const {
      location: { search },
      reloadOnSearch /*injector, mountContainer*/,
    } = this.props;
    if ((search !== prevProps.location.search && reloadOnSearch) || location.href !== prevProps.location.href) {
      this.destroyControllerInstance();
      this.mountController();
    } else {
      console.log('Broadcasting $routeUpdate');
      this.props.injector.get('$rootScope').$broadcast('$routeUpdate');
    }
  }

  componentWillUnmount() {
    this.mounted = false;
    this.destroyControllerInstance();
  }
  componentDidMount() {
    this.mountController();
  }

  // @ts-ignore
  render() {
    return null;
  }

  async mountController() {
    // This is basically a revrite on ngView directive
    // TODO: handle resolve prop on ng route
    const {
      injector,
      mountContainer,
      controller,
      controllerAs,
      resolve,
      templateUrl,
      template,
      pageClass,
      routeInfo,
    } = this.props;

    // Let's get access to injector's services
    const $route = injector.get('$route');
    const $http = injector.get('$http');
    const $controller = injector.get('$controller');
    const $compile = injector.get('$compile');
    // We are retrieving rootScope here as Grafana routes are directly under rootScope
    const scope = injector.get('$rootScope');
    const routeDescriptor = {
      templateUrl,
      template,
      controller,
      pageClass,
      reloadOnSearch: false,
      routeInfo,
    };
    let templateToRender = routeDescriptor.template;
    // This object is an answer to Angular's https://docs.angularjs.org/api/ngRoute/service/$route#current
    // Best thing is to get rid of it and store these data in e.g. Redux store
    let routeLocals = {};

    this.childScope = scope.$new();

    if (routeDescriptor.templateUrl && routeDescriptor.template) {
      templateToRender = routeDescriptor.template;
    }

    // template get's precedence over templateUrl
    // https://docs.angularjs.org/api/ngRoute/provider/$routeProvider#when
    // We retrieve the template only if it wasn't privided with template prop in route definition
    if (!templateToRender && routeDescriptor.templateUrl) {
      templateToRender = (await $http.get(routeDescriptor.templateUrl)).data;
    }

    if (resolve) {
      const resolved = { ...resolve };

      Object.keys(resolved).map(r => {
        resolved[r] = resolved[r]();
      });

      routeLocals = {
        ...routeLocals,
        ...resolved,
      };
      this.childScope['$resolve'] = resolved;
    }
    // @ts-ignore
    routeLocals['$sscope'] = this.childScope;
    // ng compatibility
    $route.updateRouteLocals(routeLocals);
    // ng compatibility
    $route.updateCurrentRoute({
      $$route: { routeInfo: routeDescriptor.routeInfo },
    });

    // TODO: not sure if this is the placev I want do emit this event
    // Best thing would be to get rid of the $route[] events at all
    scope.appEvent('$routeChangeSuccess', {
      locals: { ...routeLocals },
      params: { ...$route.current.params },
      $$route: { ...routeDescriptor },
    });

    if (routeDescriptor.controller) {
      console.log('Initialising controller:', routeDescriptor.controller);
      // const ctrl = $controller(routeDescriptor.controller, {
      //   ...routeLocals,
      //   $scope: this.childScope,
      // });
      // debugger
      // this.ctrl = ctrl;

      // if (controllerAs) {
      //   this.childScope[controllerAs || '$ctrl'] = ctrl;
      // }
      // jQuery('#ngRoot').data('$ngControllerController', ctrl);
      // jQuery('#ngRoot')
      //   .children()
      //   .data('$ngControllerController', ctrl);
      console.log('Controller instantiated:', routeDescriptor.controller);
    }
    debugger;
    mountContainer.querySelector('#ngRoot').innerHTML = templateToRender;

    $compile(mountContainer.querySelector('#ngRoot'))(scope);
    this.setBodyClass();
    this.mounted = true;
  }

  destroyControllerInstance() {
    this.childScope.$destroy();
    this.ctrl = null;
  }

  setBodyClass() {
    const { pageClass } = this.props;

    const newClassList =
      document.body.classList
        .toString()
        .split(' ')
        .filter(c => {
          return c.startsWith('page-') === false;
        })
        .join(' ') + ` ${pageClass}`;
    document.body.setAttribute('class', newClassList);
  }
}

export default NgController;
