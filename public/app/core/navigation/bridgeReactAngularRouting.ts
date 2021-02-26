import { locationService } from '@grafana/runtime';
import { coreModule } from '../core';
import { RouteProvider } from './patch/RouteProvider';
import { RouteParamsProvider } from './patch/RouteParamsProvider';
import { ILocationService } from 'angular';
import { navigationLogger } from './utils';

const registerInterceptedLinkDirective = () => {
  coreModule.directive('a', () => {
    return {
      restrict: 'E', // only Elements (<a>),
      link: (scope, elm, attr) => {
        // every time you click on the link
        elm.on('click', ($event) => {
          const href = elm.attr('href');
          if (href) {
            $event.preventDefault();
            $event.stopPropagation();

            // TODO: refactor to one method insted of chain
            locationService.getHistory().push(elm.attr('href'));
            return false;
          }

          return true;
        });
      },
    };
  });
};

// Neutralizing Angular’s location tampering
// https://stackoverflow.com/a/19825756
const tamperAngularLocation = () => {
  coreModule.config([
    '$provide',
    ($provide: any) => {
      $provide.decorator('$browser', [
        '$delegate',
        ($delegate: any) => {
          $delegate.onUrlChange = () => {};
          $delegate.url = () => '';

          return $delegate;
        },
      ]);
    },
  ]);
};

class AngularLocationWrapper {
  absUrl(): string {
    throw new Error('AngularLocationWrapper method not implemented');
  }

  hash(newHash?: any) {
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  host(): string {
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  path(pathname?: any) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: path');

    if (pathname) {
      locationService.push(pathname);
      return this as any;
    }

    return locationService.getCurrentLocation().pathname;
  }

  port(): number {
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  protocol(): string {
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  replace(): ILocationService {
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  search(search?: any, paramValue?: any) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: search');
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  state(state?: any) {
    throw new Error('AngularLocationWrapper method not implemented.');
  }

  url(newUrl?: any) {
    navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: url');

    if (newUrl) {
      locationService.push(newUrl);
    }

    return locationService.getCurrentLocation().pathname;
  }
}

// Intercepting $location service with implementation based on history
const interceptAngularLocation = () => {
  // debugger;
  coreModule.config([
    '$provide',
    ($provide: any) => {
      $provide.decorator('$location', [
        '$delegate',
        ($delegate: ILocationService) => {
          $delegate = new AngularLocationWrapper() as ILocationService;
          return $delegate;
        },
      ]);
    },
  ]);
  coreModule.provider('$route', RouteProvider);
  coreModule.provider('$routeParams', RouteParamsProvider);
};

const bridgeReactAngularRouting = () => {
  registerInterceptedLinkDirective();
  tamperAngularLocation();
  interceptAngularLocation();
};

export default bridgeReactAngularRouting;
