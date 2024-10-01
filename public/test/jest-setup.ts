// This import has side effects, and must be at the top so jQuery is made global before
// angular is imported.
import './global-jquery-shim';

import angular from 'angular';
import { TextEncoder, TextDecoder } from 'util';

import { EventBusSrv } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';
import { initIconCache } from 'app/core/icons/iconBundle';

import 'blob-polyfill';
import 'mutationobserver-shim';
import './mocks/workers';

import '../vendor/flot/jquery.flot';
import '../vendor/flot/jquery.flot.time';

// icon cache needs to be initialized for test to prevent
// libraries such as msw from throwing "unhandled resource"-errors
initIconCache();

const testAppEvents = new EventBusSrv();
const global = window as any;
global.$ = global.jQuery = $;

// mock the default window.grafanaBootData settings
const settings: Partial<GrafanaBootConfig> = {
  angularSupportEnabled: true,
  featureToggles: {},
};
global.grafanaBootData = {
  settings,
  user: {},
  navTree: [],
};

window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // Deprecated
  removeListener: jest.fn(), // Deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

angular.module('grafana', ['ngRoute']);
angular.module('grafana.services', ['ngRoute', '$strap.directives']);
angular.module('grafana.panels', []);
angular.module('grafana.controllers', []);
angular.module('grafana.directives', []);
angular.module('grafana.filters', []);
angular.module('grafana.routes', ['ngRoute']);

// mock the intersection observer and just say everything is in view
const mockIntersectionObserver = jest
  .fn()
  .mockImplementation((callback: (arg: IntersectionObserverEntry[]) => void) => ({
    observe: jest.fn().mockImplementation((elem: HTMLElement) => {
      callback([{ target: elem, isIntersecting: true }] as unknown as IntersectionObserverEntry[]);
    }),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
global.IntersectionObserver = mockIntersectionObserver;

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// add scrollTo interface since it's not implemented in jsdom
Element.prototype.scrollTo = () => {};

jest.mock('../app/core/core', () => ({
  ...jest.requireActual('../app/core/core'),
  appEvents: testAppEvents,
}));
jest.mock('../app/angular/partials', () => ({}));
jest.mock('../app/features/plugins/plugin_loader', () => ({}));

const throwUnhandledRejections = () => {
  process.on('unhandledRejection', (err) => {
    throw err;
  });
};

throwUnhandledRejections();

// Used by useMeasure
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    setTimeout(() => {
      callback(
        [
          {
            contentRect: {
              x: 1,
              y: 2,
              width: 500,
              height: 500,
              top: 100,
              bottom: 0,
              left: 100,
              right: 0,
            },
            target: {
              // Needed for react-virtual to work in tests
              getAttribute: () => 1,
            },
          } as unknown as ResizeObserverEntry,
        ],
        this
      );
    });
  }
  observe() {}
  disconnect() {}
  unobserve() {}
};
