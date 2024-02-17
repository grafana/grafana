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
    '/public/plugins/mockAmdModuleNamedNoDeps/module.js',
    () =>
      new HttpResponse(mockAmdModuleNamedNoDeps, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockAmdModuleNamedWithDeps/module.js',
    () =>
      new HttpResponse(mockAmdModuleNamedWithDeps, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockAmdModuleNamedWithDeps2/module.js',
    () =>
      new HttpResponse(mockAmdModuleNamedWithDeps2, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockAmdModuleNamedWithDeps3/module.js',
    () =>
      new HttpResponse(mockAmdModuleNamedWithDeps3, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockAmdModuleOnlyFunction/module.js',
    () =>
      new HttpResponse(mockAmdModuleOnlyFunction, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockAmdModuleWithComments/module.js',
    () =>
      new HttpResponse(mockAmdModuleWithComments, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockAmdModuleWithComments2/module.js',
    () =>
      new HttpResponse(mockAmdModuleWithComments2, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  ),
  http.get(
    '/public/plugins/mockModuleWithDefineMethod/module.js',
    () =>
      new HttpResponse(mockModuleWithDefineMethod, {
        headers: {
          'Content-Type': 'text/javascript',
        },
      })
  )
);

export { server };
