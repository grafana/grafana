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

const mockTranslation = (value: string) =>
  `System.register([],function(e){return{execute:function(){e("default",{"testKey":"${value}"})}}})`;

const mockTranslationWithNoDefaultExport = `System.register([],function(e){return{execute:function(){e({"testKey":"unknown"})}}})`;

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
  ),
  http.get(
    '/public/plugins/test-panel/locales/en-US/test-panel.json',
    () =>
      new HttpResponse(mockTranslation('testValue'), {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/test-panel/locales/pt-BR/test-panel.json',
    () =>
      new HttpResponse(mockTranslation('valorDeTeste'), {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/test-panel/locales/en-US/no-default-export.json',
    () =>
      new HttpResponse(mockTranslationWithNoDefaultExport, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get('/public/plugins/test-panel/locales/en-US/unknown.json', () => HttpResponse.error())
);

export { server };
