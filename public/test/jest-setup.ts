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

jest.mock('app/core/core', () => ({}));
jest.mock('app/features/plugins/plugin_loader', () => ({}));

configure({ adapter: new Adapter() });

var global = <any>window;
global.$ = global.jQuery = $;
