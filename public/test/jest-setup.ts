import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import 'jquery';
import $ from 'jquery';
import 'mutationobserver-shim';

const global = window as any;
global.$ = global.jQuery = $;

import '../vendor/flot/jquery.flot';
import '../vendor/flot/jquery.flot.time';
import 'angular';
import angular from 'angular';

angular.module('grafana', ['ngRoute']);
angular.module('grafana.services', ['ngRoute', '$strap.directives']);
angular.module('grafana.panels', []);
angular.module('grafana.controllers', []);
angular.module('grafana.directives', []);
angular.module('grafana.filters', []);
angular.module('grafana.routes', ['ngRoute']);

jest.mock('app/core/core', () => ({}));
jest.mock('app/features/plugins/plugin_loader', () => ({}));

configure({ adapter: new Adapter() });

const localStorageMock = (() => {
  let store: any = {};
  return {
    getItem: (key: string) => {
      return store[key];
    },
    setItem: (key: string, value: any) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

global.localStorage = localStorageMock;

const throwUnhandledRejections = () => {
  process.on('unhandledRejection', err => {
    throw err;
  });
};

throwUnhandledRejections();
