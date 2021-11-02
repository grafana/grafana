import { configure } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import $ from 'jquery';
import 'mutationobserver-shim';
var global = window;
global.$ = global.jQuery = $;
// https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(global, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(function (query) { return ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    }); }),
});
import '../vendor/flot/jquery.flot';
import '../vendor/flot/jquery.flot.time';
import angular from 'angular';
angular.module('grafana', ['ngRoute']);
angular.module('grafana.services', ['ngRoute', '$strap.directives']);
angular.module('grafana.panels', []);
angular.module('grafana.controllers', []);
angular.module('grafana.directives', []);
angular.module('grafana.filters', []);
angular.module('grafana.routes', ['ngRoute']);
jest.mock('../app/core/core', function () { return ({}); });
jest.mock('../app/angular/partials', function () { return ({}); });
jest.mock('../app/features/plugins/plugin_loader', function () { return ({}); });
configure({ adapter: new Adapter() });
var localStorageMock = (function () {
    var store = {};
    return {
        getItem: function (key) {
            return store[key];
        },
        setItem: function (key, value) {
            store[key] = value.toString();
        },
        clear: function () {
            store = {};
        },
        removeItem: function (key) {
            delete store[key];
        },
    };
})();
global.localStorage = localStorageMock;
var throwUnhandledRejections = function () {
    process.on('unhandledRejection', function (err) {
        throw err;
    });
};
throwUnhandledRejections();
//# sourceMappingURL=jest-setup.js.map