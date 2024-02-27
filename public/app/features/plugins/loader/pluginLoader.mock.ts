import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const mockSystemModule = `System.register(['./dependencyA'], function (_export, _context) {
  "use strict";

  var DependencyACtrl;
  return {
    setters: [function (_dependencyA) {
      DependencyACtrl = _dependencyA.DependencyACtrl;
    }],
    execute: function () {
      _export('PanelCtrl', DependencyACtrl);
    }
  };
});`;

export const mockAmdModule = `define([], function() {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

const server = setupServer(
  http.get(
    '/public/plugins/mockAmdModule/module.js',
    () =>
      new HttpResponse(mockAmdModule, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockSystemModule/module.js',
    () =>
      new HttpResponse(mockSystemModule, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    'http://my-cdn.com/plugins/my-plugin/v1.0.0/public/plugins/my-plugin/module.js',
    () =>
      new HttpResponse(mockAmdModule, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  )
);

export { server };
