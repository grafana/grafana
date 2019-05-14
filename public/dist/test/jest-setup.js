import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import 'jquery';
import $ from 'jquery';
import 'angular';
import angular from 'angular';
angular.module('grafana', ['ngRoute']);
angular.module('grafana.services', ['ngRoute', '$strap.directives']);
angular.module('grafana.panels', []);
angular.module('grafana.controllers', []);
angular.module('grafana.directives', []);
angular.module('grafana.filters', []);
angular.module('grafana.routes', ['ngRoute']);
jest.mock('app/core/core', function () { return ({}); });
jest.mock('app/features/plugins/plugin_loader', function () { return ({}); });
configure({ adapter: new Adapter() });
var global = window;
global.$ = global.jQuery = $;
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
// Object.defineProperty(window, 'localStorage', { value: localStorageMock });
//# sourceMappingURL=jest-setup.js.map