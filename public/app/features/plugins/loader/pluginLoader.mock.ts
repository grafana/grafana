import { rest } from 'msw';
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

export const mockAmdModuleNamedNoDeps = `define("named", function() {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

export const mockAmdModuleNamedWithDeps = `define("named", ["dep"], function(dep) {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

export const mockAmdModuleNamedWithDeps2 = `define("named", ["dep", "dep2"], function(dep, dep2) {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

export const mockAmdModuleNamedWithDeps3 = `define("named", ["dep",
"dep2"
], function(dep, dep2) {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

export const mockAmdModuleOnlyFunction = `define(function() {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

export const mockAmdModuleWithComments = `/*! For license information please see module.js.LICENSE.txt */
define(function(react) {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

export const mockAmdModuleWithComments2 = `/*! This is a commment */
define(["dep"],
  /*! This is a commment */
  function(dep) {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

export const mockModuleWithDefineMethod = `ace.define(function() {
  return function() {
    console.log('AMD module loaded');
    var pluginPath = "/public/plugins/";
  }
});`;

const server = setupServer(
  rest.get('/public/plugins/mockAmdModule/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModule))
  ),
  rest.get('/public/plugins/mockSystemModule/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockSystemModule))
  ),
  rest.get('http://my-cdn.com/plugins/my-plugin/v1.0.0/public/plugins/my-plugin/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModule))
  ),
  rest.get('/public/plugins/mockAmdModuleNamedNoDeps/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModuleNamedNoDeps))
  ),
  rest.get('/public/plugins/mockAmdModuleNamedWithDeps/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModuleNamedWithDeps))
  ),
  rest.get('/public/plugins/mockAmdModuleNamedWithDeps2/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModuleNamedWithDeps2))
  ),
  rest.get('/public/plugins/mockAmdModuleNamedWithDeps3/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModuleNamedWithDeps3))
  ),
  rest.get('/public/plugins/mockAmdModuleOnlyFunction/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModuleOnlyFunction))
  ),
  rest.get('/public/plugins/mockAmdModuleWithComments/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModuleWithComments))
  ),
  rest.get('/public/plugins/mockAmdModuleWithComments2/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockAmdModuleWithComments2))
  ),
  rest.get('/public/plugins/mockModuleWithDefineMethod/module.js', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'text/javascript'), ctx.body(mockModuleWithDefineMethod))
  )
);

export { server };
