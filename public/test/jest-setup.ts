// This import has side effects, and must be at the top so jQuery is made global before
// angular is imported.
import './global-jquery-shim';

import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import angular from 'angular';
import { configure } from 'enzyme';

import { EventBusSrv } from '@grafana/data';
import 'blob-polyfill';
import 'mutationobserver-shim';
import './mocks/workers';

import '../vendor/flot/jquery.flot';
import '../vendor/flot/jquery.flot.time';

const testAppEvents = new EventBusSrv();
const global = window as any;
global.$ = global.jQuery = $;

// https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

angular.module('grafana', ['ngRoute']);
angular.module('grafana.services', ['ngRoute', '$strap.directives']);
angular.module('grafana.panels', []);
angular.module('grafana.controllers', []);
angular.module('grafana.directives', []);
angular.module('grafana.filters', []);
angular.module('grafana.routes', ['ngRoute']);

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn().mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});
global.IntersectionObserver = mockIntersectionObserver;

jest.mock('../app/core/core', () => ({
  ...jest.requireActual('../app/core/core'),
  appEvents: testAppEvents,
}));
jest.mock('../app/angular/partials', () => ({}));
jest.mock('../app/features/plugins/plugin_loader', () => ({}));

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
  process.on('unhandledRejection', (err) => {
    throw err;
  });
};

throwUnhandledRejections();
