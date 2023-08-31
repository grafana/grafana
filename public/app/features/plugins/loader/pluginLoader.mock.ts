import { rest } from 'msw';
import { setupServer } from 'msw/node';

export const mockAmdModule = `define([], function() {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

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

const server = setupServer(
  rest.get('/public/plugins/my-amd-plugin/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModule))
  ),
  rest.get('/public/plugins/my-system-plugin/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockSystemModule))
  ),
  rest.get('http://my-cdn.com/plugins/my-plugin/v1.0.0/public/plugins/my-plugin/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModule))
  )
);

export { server };
