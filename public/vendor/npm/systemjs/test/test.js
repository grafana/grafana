"format global";

(function(global) {

QUnit.config.testTimeout = 30000;

QUnit.module("SystemJS");

if (typeof window == 'undefined')
  System.baseURL = 'test';

function err(e) {
  setTimeout(function() {
    if (typeof window == 'undefined')
      console.log(e && e.stack || e);
    else
      throw e;
    start();
  });
}

var ie8 = typeof navigator != 'undefined' && navigator.appVersion && navigator.appVersion.indexOf('MSIE 8') != -1;

asyncTest('System version', function() {
  ok(System.version.match(/^\d+\.\d+\.\d+(-\w+)? (Standard|Node)$/));
  start();
});

asyncTest('new Module().toString() == "Module"', function() {
  System['import']('tests/global.js').then(function() {
    var m = System.get(System.normalizeSync('tests/global.js'));
    ok(m == 'Module');
    start();
  });
});

asyncTest('Error handling', function() {
  System['import']('tests/error-loader.js').then(err, function(e) {
    ok(true);
    start();
  });
});

asyncTest('Error handling2', function() {
  System['import']('tests/error-loader2.js').then(err, function(e) {
    if (typeof console != 'undefined' && console.error)
      console.error(e);
    ok(true);
    start();
  });
});

if (!ie8)
asyncTest('Global script loading', function() {
  System['import']('tests/global.js').then(function(m) {
    ok(m.jjQuery && m.another, 'Global objects not defined');
    start();
  }, err);
});

if (!ie8)
asyncTest('Global script with var syntax', function() {
  System['import']('tests/global-single.js').then(function(m) {
    ok(m == 'bar', 'Wrong global value');
    start();
  }, err);
});

asyncTest('Global script with multiple objects the same', function() {
  System['import']('tests/global-multi.js').then(function(m) {
    ok(m.jquery == 'here', 'Multi globals not detected');
    start();
  }, err);
});

if (!ie8)
asyncTest('Global script multiple objects different', function() {
  System['import']('tests/global-multi-diff.js').then(function(m) {
    ok(m.foo == 'barz');
    ok(m.baz == 'chaz');
    ok(m.zed == 'ted');
    start();
  }, err);
});

asyncTest('Global script loading with inline shim', function() {
  System['import']('tests/global-inline-dep.js').then(function(m) {
    ok(m == '1.8.3', 'Global dependency not defined');
    start();
  }, err);
});

asyncTest('Global script with inline exports', function() {
  System['import']('tests/global-inline-export.js').then(function(m) {
    ok(m == 'r', 'Inline export not applied');
    start();
  }, err);
});

asyncTest('Global script with shim config', function() {
  System.config({
    meta: {
      'tests/global-shim-config.js': {
        deps: ['./global-shim-config-dep.js']
      }
    }
  });
  // System. = { deps: ['./global-shim-config-dep.js'] };
  System['import']('tests/global-shim-config.js').then(function(m) {
    ok(m == 'shimmed', 'Not shimmed');
    start();
  }, err);
});

if (!ie8)
asyncTest('Global script with inaccessible properties', function() {
  Object.defineProperty(System.global, 'errorOnAccess', {
    configurable: true,
    enumerable: true,
    get: function() { throw Error('This property is inaccessible'); },
  });

  System['import']('tests/global-inaccessible-props.js').then(function(m) {
    ok(m == 'result of global-inaccessible-props', 'Failed due to a inaccessible property');

    delete System.global.errorOnAccess;
    start();
  }, err);
});

asyncTest('Global script loading that detects as AMD with shim config', function() {
  System.config({
    meta: {
      'tests/global-shim-amd.js': { format: 'global' }
    }
  });

  System['import']('tests/global-shim-amd.js').then(function(m) {
    ok(m == 'global', 'Not shimmed');
    start();
  }, err);
});

if (!ie8)
asyncTest('Meta should override meta syntax', function() {
  System.meta[System.normalizeSync('tests/meta-override.js')] = { format: 'esm' };
  System['import']('tests/meta-override.js').then(function(m) {
    ok(m.p == 'value', 'Not ES6');
    start();
  }, err);
});

asyncTest('Support the empty module', function() {
  System['import']('@empty').then(function(m) {
    ok(m, 'No empty module');
    start();
  }, err);
});

asyncTest('Global script with shim config exports', function() {
  System.meta[System.normalizeSync('tests/global-shim-config-exports.js')] = { exports: 'p' };
  System['import']('tests/global-shim-config-exports.js').then(function(m) {
    ok(m == 'export', 'Exports not shimmed');
    start();
  }, err);
});

asyncTest('Map configuration', function() {
  System.map['maptest'] = 'tests/map-test.js';
  System['import']('maptest').then(function(m) {
    ok(m.maptest == 'maptest', 'Mapped module not loaded');
    start();
  }, err);
});

asyncTest('Map configuration subpath', function() {
  System.map['maptest'] = 'tests/map-test';
  System['import']('maptest/sub.js').then(function(m) {
    ok(m.maptest == 'maptestsub', 'Mapped folder not loaded');
    start();
  }, err);
});

asyncTest('Contextual map configuration', function() {
  System.config({
    packages: {
      'tests/contextual-test': {
        main: 'contextual-map.js'
      }
    },
    map: {
      'tests/contextual-test': {
        maptest: '../contextual-map-dep.js'
      }
    }
  });
  System['import']('tests/contextual-test').then(function(m) {
    ok(m.mapdep == 'mapdep', 'Contextual map dep not loaded');
    start();
  }, err);
});

asyncTest('Package map with shim', function() {
  System.config({
    packages: {
      'tests/shim-package': {
        meta: {
          '*': {
            deps: ['shim-map-dep']
          }
        },
        map: {
          'shim-map-dep': '../shim-map-test-dep.js'
        }
      }
    }
  });
  System['import']('tests/shim-package/shim-map-test.js').then(function(m) {
    ok(m == 'depvalue', 'shim dep not loaded');
    start();
  }, err);
});

asyncTest('Loading an AMD module', function() {
  System.config({
    meta: {
      'tests/amd-module.js': {
        format: 'amd'
      }
    }
  });
  System['import']('tests/amd-module.js').then(function(m) {
    ok(m.amd == true, 'Incorrect module');
    ok(m.dep.amd == 'dep', 'Dependency not defined');
    start();
  }, err);
});

asyncTest('AMD detection test', function() {
  System['import']('tests/amd-module-2.js').then(function(m) {
    ok(m.amd);
    start();
  }, err);
});

asyncTest('AMD detection test with comments', function() {
  System['import']('tests/amd-module-3.js').then(function(m) {
    ok(m.amd);
    start();
  }, err);
});

asyncTest('AMD detection test with byte order mark (BOM)', function() {
  System['import']('tests/amd-module-bom.js').then(function(m) {
    ok(m.amd);
    start();
  }, err);
});

asyncTest('AMD with dynamic require callback', function() {
  System['import']('tests/amd-dynamic-require.js').then(function(m) {
    m.onCallback(function(m) {
      ok(m === 'dynamic');
      start();
    });
  });
});

asyncTest('Loading an AMD bundle', function() {
  System.config({
    bundles: {
      'tests/amd-bundle.js': ['bundle-1', 'bundle-2']
    }
  });
  System['import']('bundle-1').then(function(m) {
    ok(m.defined == true);
    start();
  }, err);

  stop();
  System['import']('bundle-2').then(function(m) {
    ok(m.defined == true);
    start();
  }, err);
});

asyncTest('Loading an AMD named define', function() {
  System['import']('tests/nameddefine.js').then(function(m1) {
    ok(m1.converter, 'Showdown not loaded');
    System['import']('another-define').then(function(m2) {
      ok(m2.named === 'define', 'Another module is not defined');
      start();
    }, err);
  }, err);
});

asyncTest('Loading AMD CommonJS form', function() {
  System['import']('tests/amd-cjs-module.js').then(function(m) {
    ok(m.test == 'hi', 'Not defined');
    start();
  }, err);
});

asyncTest('AMD contextual require toUrl', function() {
  System['import']('tests/amd-contextual.js').then(function(m) {
    ok(m.name == System.baseURL + 'tests/amd-contextual.js');
    ok(m.rel == System.baseURL + 'rel-path.js');
    start();
  }, err);
});

asyncTest('Loading a CommonJS module', function() {
  System['import']('tests/common-js-module.js').then(function(m) {
    ok(m.hello == 'world', 'module value not defined');
    ok(m.first == 'this is a dep', 'dep value not defined');
    start();
  }, err);
});

asyncTest('Loading a CommonJS module with this', function() {
  System['import']('tests/cjs-this.js').then(function(m) {
    ok(m.asdf == 'module value');
    start();
  }, err);
});

asyncTest('CommonJS setting module.exports', function() {
  System['import']('tests/cjs-exports.js').then(function(m) {
    ok(m.e == 'export');
    start();
  }, err);
});

asyncTest('CommonJS detection variation 1', function() {
  System['import']('tests/commonjs-variation.js').then(function(m) {
    ok(m.e === System.get('@empty'));
    start();
  }, err);
});

if (!ie8)
asyncTest('CommonJS detection variation 2', function() {
  System['import']('tests/commonjs-variation2.js').then(function(m) {
    ok(typeof m.OpaqueToken === 'function');
    start();
  }, err);
});

asyncTest('CommonJS detection test with byte order mark (BOM)', function() {
  System['import']('tests/cjs-exports-bom.js').then(function(m) {
    ok(m.foo == 'bar');
    start();
  }, err);
});

asyncTest('CommonJS module detection test with byte order mark (BOM)', function() {
  System['import']('tests/cjs-module-bom.js').then(function(m) {
    ok(m.foo == 'bar');
    start();
  }, err);
});

asyncTest('CommonJS require variations', function() {
  System['import']('tests/commonjs-requires.js').then(function(m) {
    ok(m.d1 == 'd');
    ok(m.d2 == 'd');
    ok(m.d3 == "require('not a dep')");
    ok(m.d4 == "text/* require('still not a dep') text");
    ok(m.d5 == 'text \'quote\' require("yet still not a dep")');
    ok(m.d6 == 'd6');
    start();
  }, err);
});

asyncTest('CommonJS globals', function() {
  System.config({
    meta: {
      'tests/commonjs-globals.js': {
        globals: {
          process: './cjs-process.js'
        }
      }
    }
  });
  System['import']('tests/commonjs-globals.js').then(function(m) {
    ok(m.process.env.NODE_ENV)
    start();
  }, err);
});

asyncTest('Loading a UMD module', function() {
  System['import']('tests/umd.js').then(function(m) {
    ok(m.d == 'hi', 'module value not defined');
    start();
  }, err);
});

asyncTest('Loading AMD with format hint', function() {
  System['import']('tests/amd-format.js').then(function(m) {
    ok(m.amd == 'amd', 'AMD not loaded');
    start();
  }, err);
});

asyncTest('Loading CJS with format hint', function() {
  System['import']('tests/cjs-format.js').then(function(m) {
    ok(m.cjs == 'cjs', 'CJS not loaded');
    start();
  }, err);
});

asyncTest('CommonJS globals', function() {
  System['import']('tests/cjs-globals.js').then(function(m) {
    ok(m.filename.match(/tests\/cjs-globals\.js$/));
    ok(m.dirname.match(/\/tests$/));
    ok(m.global == global);
    start();
  }, err);
});

asyncTest('Versions', function() {
  System['import']('tests/zero@0.js').then(function(m) {
    ok(m == '0');
    start()
  }, err);
});

asyncTest('Loading a module with # in the name', function() {
  System['import']('tests/#.js').then(function(m) {
    ok(m == '#');
    start();
  }, err);
});

asyncTest('Simple compiler Plugin', function() {
  System.map['coffee'] = 'tests/compiler-plugin.js';
  System['import']('tests/compiler-test.coffee!').then(function(m) {
    ok(m.output == 'plugin output', 'Plugin not working.');
    ok(m.extra == 'yay!', 'Compiler not working.');
    start();
  }, err);
});

asyncTest('Mapping a plugin argument', function() {
  System.map['bootstrap'] = 'tests/bootstrap@3.1.1';
  System.map['coffee'] = 'tests/compiler-plugin.js';
  System['import']('bootstrap/test.coffee!coffee').then(function(m) {
    ok(m.extra == 'yay!', 'not working');
    start();
  }, err);
});

asyncTest('Using pluginFirst config', function() {
  System.pluginFirst = true;
  System.map['bootstrap'] = 'tests/bootstrap@3.1.1';
  System.map['coffee'] = 'tests/compiler-plugin.js';
  System['import']('coffee!bootstrap/test.coffee').then(function(m) {
    ok(m.extra == 'yay!', 'not working');
    System.pluginFirst = false;
    start();
  }, err);
});

asyncTest('Advanced compiler plugin', function() {
  System['import']('tests/compiler-test.js!tests/advanced-plugin.js').then(function(m) {
    ok(m == 'custom fetch:' + System.baseURL + 'tests/compiler-test.js!' + System.baseURL + 'tests/advanced-plugin.js', m);
    start();
  }, err);
});

asyncTest('Plugin as a dependency', function() {
  System.map['css'] = 'tests/css.js';
  System['import']('tests/cjs-loading-plugin.js').then(function(m) {
    ok(m.pluginSource == 'this is css');
    start();
  }, err);
});

asyncTest('AMD Circular', function() {
  System['import']('tests/amd-circular1.js').then(function(m) {
    ok(m.outFunc() == 5, 'Expected execution');
    start();
  })['catch'](err);
});

asyncTest('CJS Circular', function() {
  System['import']('tests/cjs-circular1.js').then(function(m) {
    ok(m.first == 'second value');
    ok(m.firstWas == 'first value', 'Original value');
    start();
  }, err);
});

asyncTest('System.register Circular', function() {
  System.config({
    meta: {
      'tests/register-circular1.js': {
        scriptLoad: true
      }
    }
  });
  System['import']('tests/register-circular1.js').then(function(m) {
    ok(m.q == 3, 'Binding not allocated');
    ok(m.r == 5, 'Binding not updated');
    start();
  }, err);
});

asyncTest('System.register regex test', function() {
  System['import']('tests/register-regex.js').then(function(m) {
    ok(m);
    start();
  }, err);
});

asyncTest('System.register group linking test', function() {
  System.config({
    bundles: {
      'tests/group-test.js': ['group-a']
    }
  });
  System['import']('group-a').then(function(m) {
    ok(m);
    start();
  }, err);
});

System.config({
  bundles: {
    'tests/mixed-bundle.js': ['tree/third', 'tree/cjs', 'tree/jquery', 'tree/second', 'tree/global', 'tree/amd', 'tree/first']
  }
});

asyncTest('Loading AMD from a bundle', function() {
  System['import']('tree/amd').then(function(m) {
    ok(m.is == 'amd');
    start();
  }, err);
});

asyncTest('Loading CommonJS from a bundle', function() {
  System['import']('tree/cjs').then(function(m) {
    ok(m.cjs === true);
    start();
  }, err);
});

asyncTest('Loading a Global from a bundle', function() {
  System['import']('tree/global').then(function(m) {
    ok(m === 'output');
    start();
  }, err);
});

asyncTest('Loading named System.register', function() {
  System['import']('tree/third').then(function(m) {
    ok(m.some == 'exports');
    start();
  }, err);
});
asyncTest('Loading System.register from ES6', function() {
  System.config({
    meta: {
      'tree/first': {
        format: 'esm'
      }
    }
  });
  System['import']('tree/first').then(function(m) {
    ok(m.p == 5);
    start();
  }, err);
});

asyncTest('AMD simplified CommonJS wrapping with an aliased require', function() {
  System['import']('tests/amd-simplified-cjs-aliased-require1.js').then(function(m) {
    ok(m.require2,"got dependency from aliased require");
    ok(m.require2.amdCJS,"got dependency from aliased require listed as a dependency");
    start();
  }, err);
});

asyncTest('Loading dynamic modules with __esModule flag set', function() {
  System['import']('tests/es-module-flag.js').then(function() {
    m = System.get(System.normalizeSync('tests/es-module-flag.js'));
    ok(m.exportName == 'export');
    ok(m['default'] == 'default export');
    ok(m.__esModule === true);
    start();
  }, err);
});

if (!ie8) {
asyncTest('ES6 named export loading of CJS', function() {
  System['import']('tests/es-named-import-cjs.js').then(function(m) {
    ok(m.cjsFuncValue === 'named export');
    start();
  });
});

// TypeScript does not support async functions yet
if (System.transpiler !== 'typescript')
asyncTest('Async functions', function() {
  System.babelOptions = { stage: 0 };
  System.traceurOptions = { asyncFunctions: true };
  System['import']('tests/async.js').then(function(m) {
    ok(true);
    start();
  });
});

if (System.transpiler !== 'typescript')
asyncTest('Wrapper module support', function() {
  System['import']('tests/wrapper.js').then(function(m) {
    ok(m.d == 'default1', 'Wrapper module not defined.');
    start();
  }, err);
});

asyncTest('ES6 plugin', function() {
  System['import']('tests/blah.js!tests/es6-plugin.js').then(function(m) {
    ok(m == 'plugin');
    start();
  }, err);
});

asyncTest('ES6 detection', function() {
  System['import']('tests/es6-detection1.js').then(function(m) {
    ok(true);
    start();
  }, err);
});

asyncTest('Basic exporting & importing', function() {
  var m1, m2, m3, m4, err;
  var checkComplete = function() {
    if (m1 && m2 && m3 && m4 && err) {
      ok(m1['default'] == 'default1', 'Error defining default 1');
      ok(m2['default'] == 'default2', 'Error defining default 2');
      ok(m3['default'] == 'default3', 'Error defining default 3');
      ok(m4.test == 'default3', 'Error defining module');
      start();
    }
  };
  System['import']('tests/default1.js').then(function(_m1) {
    if (m1 === undefined)
      m1 = null;
    else
      m1 = _m1;
    checkComplete();
  })['catch'](err);
  System['import']('tests/default1.js').then(function(_m1) {
    if (m1 === undefined)
      m1 = null;
    else
      m1 = _m1;
    checkComplete();
  })['catch'](err);
  System['import']('tests/default2.js').then(function(_m2) {
    m2 = _m2;
    checkComplete();
  })['catch'](err);
  System['import']('tests/asdf.js').then(function() {
  }, function(_err) {
    err = _err;
    checkComplete();
  })['catch'](err);
  System['import']('tests/default3.js').then(function(_m3) {
    m3 = _m3;
    checkComplete();
  })['catch'](err);
  System['import']('tests/module.js').then(function(_m4) {
    m4 = _m4;
    checkComplete();
  })['catch'](err);
});

asyncTest('Export Star', function(assert) {
  System['import']('tests/export-star.js').then(function(m) {
    ok(m.foo == 'foo');
    ok(m.bar == 'bar');
    start();
  }, err);
});

asyncTest('Importing a mapped loaded module', function() {
  System.map['default1'] = 'tests/default1.js';
  System['import']('default1').then(function(m) {
    System['import']('default1').then(function(m) {
      ok(m, 'no module');
      start();
    }, err);
  }, err);
});

asyncTest('Loading empty ES6', function() {
  System['import']('tests/empty-es6.js').then(function(m) {
    ok(m && emptyES6);
    start();
  }, err);
})

asyncTest('Loading ES6 with format hint', function() {
  System['import']('tests/es6-format.js').then(function(m) {
    expect(0);
    start();
  }, err);
});

asyncTest('Loading ES6 loading AMD', function() {
  System['import']('tests/es6-loading-amd.js').then(function(m) {
    ok(m.amd == true);
    start();
  })
});

asyncTest('Loading AMD with import *', function() {
  System['import']('tests/es6-import-star-amd.js').then(function(m) {
    ok(m.g == true);
    start();
  }, err);
});

asyncTest('Loading ES6 and AMD', function() {
  System['import']('tests/es6-and-amd.js').then(function(m) {
    ok(m.amd_module == 'AMD Module');
    ok(m.es6_module == 'ES6 Module');
    start();
  }, err);
});

asyncTest('Module Name meta', function() {
  System['import']('tests/reflection.js').then(function(m) {
    ok(m.myname == System.normalizeSync('tests/reflection.js'), 'Module name not returned');
    start();
  }, err);
});

asyncTest('Relative dyanamic loading', function() {
  System['import']('tests/reldynamic.js').then(function(m) {
    return m.dynamicLoad();
  })
  .then(function(m) {
    ok(m.dynamic == 'module', 'Dynamic load failed');
    start();
  })
  ['catch'](err);
});

asyncTest('ES6 Circular', function() {
  System['import']('tests/es6-circular1.js').then(function(m) {
    ok(m.q == 3, 'Binding not allocated');
    if (System.transpiler != '6to5') ok(m.r == 3, 'Binding not updated');
    start();
  }, err);
});

asyncTest('AMD & CJS circular, ES6 Circular', function() {
  System['import']('tests/all-circular1.js').then(function(m) {
    if (System.transpiler != '6to5') ok(m.q == 4);
    ok(m.o.checkObj() == 'changed');
    start();
  }, err);
});

asyncTest('AMD -> System.register circular -> ES6', function() {
  System['import']('tests/all-layers1.js').then(function(m) {
    ok(m == true)
    start();
  }, err);
});

asyncTest('Metadata dependencies work for named defines', function() {
  System['import']('tests/meta-deps.js').then(function(m) {
    return System['import']('b');
  }).then(function(m) {
    ok(m.a === 'a');
    start();
  });
});

asyncTest('Loading an AMD module that requires another works', function() {
  expect(0);
  System['import']('tests/amd-require.js').then(function(){
    // Just getting this far means it is working.
    start();
  });
});

asyncTest('Loading a connected tree that connects ES and CJS modules', function(){
	System['import']('tests/connected-tree/a.js').then(function(a){
		ok(a.name === "a");
		start();
	});
});

asyncTest('Loading two bundles that have a shared dependency', function() {
  System.config({
    bundles: {
      "tests/shared-dep-bundles/a.js": ["lib/shared-dep", "lib/a"],
      "tests/shared-dep-bundles/b.js": ["lib/shared-dep", "lib/b"]
    }
  });
  expect(0);
  System['import']('lib/a').then(function() {
    System['import']('lib/b').then(function() {
      //If it gets here it's fine
      start();
    }, err);
  }, err);
});
}

asyncTest("System clone", function() {
  var clonedSystem = new System.constructor();

  clonedSystem.paths['*'] = System.paths['*'];
  clonedSystem.baseURL = System.baseURL;

  System.map['maptest'] = 'tests/map-test.js';
  clonedSystem.map['maptest'] = 'tests/map-test-dep.js';

  Promise.all([System['import']('maptest'), clonedSystem['import']('maptest')]).then(function(modules) {
    var m = modules[0];
    var mClone = modules[1];

    ok(m.maptest == 'maptest', 'Mapped module not loaded');
    ok(mClone.dep == 'maptest', 'Mapped module not loaded');
    ok(mClone !== m, "different modules");

    start();
  }, err);
});

if(typeof window !== 'undefined' && window.Worker) {
  asyncTest('Using SystemJS in a Web Worker', function() {
    var worker = new Worker('./tests/worker-' + System.transpiler + '.js');
    worker.onmessage = function(e) {
      ok(e.data.amd === 'AMD Module');
      ok(e.data.es6 === 'ES6 Module');
      start();
    };
  });
}

asyncTest("Duplicate entries", function() {
  System["import"]('tests/duplicateDeps/m1.js').then(function(m) {
    var r = m.foo() + ":" + m.f3();
    ok(r === "3:3", "duplicate entries in dependency list not handled correctly");
    start();
  })
});

// new features!!
if (!ie8)
asyncTest('Named imports for non-es6', function() {
  System['import']('tests/es6-cjs-named-export.js').then(function(m) {
    ok(m.someExport == 'asdf');
    start();
  }, err);
});

asyncTest('Globals', function() {
  System.config({
    meta: {
      'tests/with-global-deps.js': {
        globals: {
          '$$$': 'tests/dep.js'
        }
      }
    }
  });
  System['import']('tests/with-global-deps.js').then(function(m) {
    for (var p in m)
      ok(false);
    ok(!global.$$$);
    start();
  }, err);
});

asyncTest('Multi-format deps meta', function() {
  System['import']('tests/amd-extra-deps.js').then(function(m) {
    ok(m.join(',') == '10,5');
    start();
  }, err);
});


asyncTest('Wildcard meta', function() {
  System.config({
    meta: {
      'tests/cs/main.js': {
        deps: ['./dep.js']
      },
      'tests/cs/*': {
        loader: 'tests/cs-loader.js'
      }
    }
  });
  System['import']('tests/cs/main.js').then(function(m) {
    ok(m == 'cs');
    start();
  });
});

asyncTest('Package configuration CommonJS config example', function() {
  System.config({
    map: {
      'global-test': 'tests/testpkg/test.ts'
    },
    //packageConfigPaths: ['tests/testpk*.json'],
    packageConfigPaths: ['tests/testpkg/system.json', 'tests/testpkg/depcache.json'],
    packages: {
      'tests/testpkg': {
        main: './noext',
        map: {
          "testpkg": "."
        },
        asdf: 'asdf'
      }
    }
  });

  Promise.all([
    System['import']('tests/testpkg'),
    System['import']('tests/testpkg/json'),
    System['import']('tests/testpkg/dir/test'),
    System['import']('tests/testpkg/dir2'),
    System['import']('tests/testpkg/dir/'),
    System['import']('tests/testpkg/env-module'),
    System['import']('tests/testpkg/self'),
    System['import']('tests/testpkg/conditional1'),
    System['import']('tests/testpkg/conditional2'),
    System['import']('tests/testpkg/self-load.js'),
    System['import']('tests/testpkg/dir/self-load.js')
  ]).then(function(m) {
    ok(m[0].prop == 'value');
    ok(m[1].prop == 'value');
    ok(m[2] == 'ts');
    ok(m[3].json == 'index');
    ok(m[4] == 'dirindex');
    ok(m[5] == (typeof window != 'undefined' ? 'browser' : 'not browser'));
    ok(m[6].prop == 'value');
    ok(m[7] == 'interpolated!');
    ok(m[8] == 'interpolated!');
    ok(m[9].a.prop == 'value' && m[9].b.prop == 'value');
    ok(m[10].a.prop == 'value' && m[10].b.prop == 'value');
    ok(global.depCacheTest == 'passed');
    start();
  }, err);
});

asyncTest('Package edge cases', function() {

  var clonedSystem = new System.constructor();

  var pkgCfg = { defaultExtension: 'asdf' };

  try {
    clonedSystem.config({
      packages: {
        '//': pkgCfg
      }
    });
    ok(false);
  }
  catch(e) {
    ok(e.toString().indexOf('not a valid package name') != -1);
  }

  try {
    clonedSystem.config({
      packages: {
        'https://': pkgCfg
      }
    });
    ok(false);
  }
  catch(e) {
    ok(e.toString().indexOf('not a valid package name') != -1);
  }

  clonedSystem.config({
    packages: {
      'https://cdn.jquery.com': pkgCfg,
      '//cdn.jquery.com': pkgCfg
    }
  });

  clonedSystem.config({
    packages: {
      // both equivalent:
      '.': pkgCfg,
      './': pkgCfg,

      '/': pkgCfg,

      // this is now a nested package
      // but our trailling / should avoid extension rules
      // both equivalent:
      '../': pkgCfg,
      '..': pkgCfg
    }
  });

  // ensure trailing "/" is equivalent to "tests/testpkg"
  clonedSystem.config({
    packageConfigPaths: ['tests/*.json/'],
    packages: {
      'tests/testpkg2/': {
        basePath: '.',
        defaultExtension: 'js'
      }
    }
  });

  // we now have nested packages:
  // testpkg/ within test/ within / root://
  // we're testing that we always select the rules of the inner package
  clonedSystem['import']('tests/testpkg2/asdf.asdf').then(function(m) {
    ok(m.asdf == 'asdf');
    start();
  }, err);
});

if (!ie8)
asyncTest('Conditional loading', function() {
  System.set('env', System.newModule({ 'browser': 'ie' }));

  System['import']('tests/branch-#{env|browser}.js').then(function(m) {
    ok(m.branch == 'ie');
    start();
  }, err);
});

asyncTest('Boolean conditional false', function() {
  System.set('env', System.newModule({ 'js': { 'es5': true } }));

  System['import']('tests/branch-boolean.js#?~env|js.es5').then(function(m) {
    ok(m === System.get('@empty'));
    start();
  }, err);
});

if (!ie8)
asyncTest('Boolean conditional true', function() {
  System.set('env', System.newModule({ 'js': { 'es5': true } }));

  System.config({
    paths: {
      'branch-boolean.js': 'tests/branch-boolean.js'
    }
  });

  System['import']('branch-boolean.js#?env|js.es5').then(function(m) {
    ok(m['default'] === true);
    start();
  }, err);
});

asyncTest('Loading a System.registerdynamic module (not bundled)', function() {
  System['import']('tests/registerdynamic-main.js').then(function(m) {
    ok(typeof m.dependency === 'function');
    ok(m.dependency() === 'ok');
    start();
  }).then(null, err);
});

asyncTest('Importing a script with wrong integrity fails', function() {
  System.config({
    meta: {
      'tests/csp/integrity.js': {
        format: 'amd',
        integrity: 'sha256-abc'
      }
    }
  });
  System['import']('tests/csp/integrity.js').then(function(m) {
    ok(true);
    console.log('SRI not supported in this browser');
    start();
  }, function(e) {
    ok(typeof e !== 'undefined');
    start();
  });
});

if (typeof process != 'undefined') {
  asyncTest('Loading Node core modules', function() {
    System['import']('@node/fs').then(function(m) {
      ok(m.writeFile);
      start();
    });
  });


  asyncTest('No global define leak in Node', function() {
    ok(typeof define == 'undefined');
    start();
  });
}

})(typeof window == 'undefined' ? global : window);
