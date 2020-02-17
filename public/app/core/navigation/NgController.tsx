import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
// import jQuery from 'jquery';
import { getAngularLoader } from '@grafana/runtime';
import { RouteDescriptor } from '../../routes/routes';

interface NgControllerProps extends RouteComponentProps<any>, RouteDescriptor {
  injector: any;
  mountContainer: HTMLElement;
}

class NgController extends React.Component<NgControllerProps, { $scope: any }> {
  container: HTMLElement;
  childScope: any;
  mounted: boolean;
  ctrl: any;
  $angularComponent: any;

  constructor(props: NgControllerProps) {
    super(props);
    this.mounted = false;
  }
  componentWillReceiveProps() {
    console.log('component will receive');
  }

  updateUrl() {
    const { match, location, injector } = this.props;
    const $route = injector.get('$route');
    debugger;

    // $route.updateRoute(match, location);
  }

  componentDidUpdate(prevProps: NgControllerProps) {
    // console.log('updating', prevProps, this.props)
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
    console.log('Unmounting', this.props.controller);
    this.destroyControllerInstance();
  }

  async componentDidMount() {
    await this.mountController();
  }

  // @ts-ignore
  render() {
    return null;
  }

  async mountController() {
    // This is basically a revrite on ngView directive
    // TODO: handle resolve prop on ng route
    const { injector, mountContainer, controller, templateUrl, pageClass, routeInfo } = this.props;

    // Let's get access to injector's services
    // const $route = injector.get('$route');
    const $http = injector.get('$http');
    const $controller = injector.get('$controller');
    // We are retrieving rootScope here as Grafana routes are directly under rootScope
    const scope = injector.get('$rootScope');
    const routeDescriptor = {
      templateUrl,
      controller,
      pageClass,
      reloadOnSearch: false,
      routeInfo,
    };
    // let templateToRender = routeDescriptor.templte;

    // This object is an answer to Angular's https://docs.angularjs.org/api/ngRoute/service/$route#current
    // Best thing is to get rid of it and store these data in e.g. Redux store
    // let routeLocals = {};
    // this.childScope = ;
    const $scope = scope.$new();

    const templateToRender = (await $http.get(routeDescriptor.templateUrl)).data;
    const ctrl = $controller(routeDescriptor.controller, { $scope });
    this.$angularComponent = getAngularLoader().load(
      mountContainer.querySelector('#ngRoot'),
      { ctrl },
      templateToRender
    );

    this.ctrl = ctrl;

    this.setBodyClass();
    this.mounted = true;
    // this.setStat e({$scope})
  }

  destroyControllerInstance() {
    // this.state.$scope.$destroy();
    this.ctrl = null;
    // debugger
    this.$angularComponent.destroy();
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
