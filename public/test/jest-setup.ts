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

// Disabled due to issue in Node.JS 8.x environment
// https://github.com/facebook/jest/issues/3803
/**
 * Using enzyme with JSDOM
 * https://github.com/airbnb/enzyme/blob/master/docs/guides/jsdom.md
 */

/*
import { JSDOM } from 'jsdom';

const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const jsdom_window = jsdom.window;

function copyProps(src, target) {
  const props = Object.getOwnPropertyNames(src)
    .filter(prop => typeof target[prop] === 'undefined')
    .reduce(
      (result, prop) => ({
        ...result,
        [prop]: Object.getOwnPropertyDescriptor(src, prop),
      }),
      {}
    );
  Object.defineProperties(target, props);
}

global.window = jsdom_window;
global.document = jsdom_window.document;
global.navigator = {
  userAgent: 'node.js',
};
copyProps(jsdom_window, global);
*/
