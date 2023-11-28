// This import has side effects, and must be at the top so jQuery is made global before
// angular is imported.
import './global-jquery-shim';
import angular from 'angular';
import { TextEncoder, TextDecoder } from 'util';
import { EventBusSrv } from '@grafana/data';
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
const global = window;
global.$ = global.jQuery = $;
// mock the default window.grafanaBootData settings
const settings = {
    angularSupportEnabled: true,
};
global.grafanaBootData = {
    settings,
    user: {},
    navTree: [],
};
// https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(global, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
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
// mock the intersection observer and just say everything is in view
const mockIntersectionObserver = jest
    .fn()
    .mockImplementation((callback) => ({
    observe: jest.fn().mockImplementation((elem) => {
        callback([{ target: elem, isIntersecting: true }]);
    }),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));
global.IntersectionObserver = mockIntersectionObserver;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
jest.mock('../app/core/core', () => (Object.assign(Object.assign({}, jest.requireActual('../app/core/core')), { appEvents: testAppEvents })));
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
    //callback: ResizeObserverCallback;
    constructor(callback) {
        setTimeout(() => {
            callback([
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
                    target: {},
                },
            ], this);
        });
    }
    observe() { }
    disconnect() { }
    unobserve() { }
};
//# sourceMappingURL=jest-setup.js.map