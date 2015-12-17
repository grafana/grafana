## Configuration API

### Setting Configuration

Once SystemJS has loaded, configuration can be set on SystemJS by using the configuration function `System.config`:

```javascript
System.config({
  configA: {},
  configB: 'value'
});
```

This is a helper function which normalizes configuration and sets configuration properties on the SystemJS instance.

`System.config({ prop: 'value' })` is mostly equivalent to `System.prop = value` except that it will extend configuration objects,
and certain properties will be normalized to be stored correctly.

For this reason it is usually advisable to use `System.config` instead of setting instance properties directly.

### Configuration Options

* [babelOptions](#babeloptions)
* [bundle](#bundle)
* [defaultJSExtensions](#defaultjsextensions)
* [depCache](#depcache)
* [map](#map)
* [meta](#meta)
* [packages](#packages)
* [paths](#paths)
* [traceurOptions](#traceuroptions)
* [transpiler](#transpiler)
* [typescriptOptions](#typescriptoptions)

#### babelOptions
Type: `Object`
Default: `{}`

Set the Babel transpiler options when [System.transpiler](#transpiler) is set to `babel`:

```javascript
System.config({
  babelOptions: {
    stage: 1
  }
});
```

A list of options is available in the [Babel project documentation](https://babeljs.io/docs/usage/options/).

#### bundle
Type: `Object`

Bundles allow a collection of modules to be downloaded together as a package whenever any module from that collection is requested.
Useful for splitting an application into sub-modules for production. Use with the [SystemJS Builder](https://github.com/systemjs/builder).

```javascript
System.config({
  bundles: {
    bundleA: ['dependencyA', 'dependencyB']
  }
});
```

In the above any require to `dependencyA` or `dependencyB` will first trigger a `System.import('bundleA')` before proceeding with the load of `dependencyA` or `dependencyB`.

It is an alternative to including a script tag for a bundle in the page, useful for bundles that load dynamically where we want to trigger the bundle load automatically only when needed.

The bundle itself is a module which contains named System.register and define calls as an output of the builder. The dependency names the bundles config lists should be the same names that are explicitly defined in the bundle.

#### defaultJSExtensions

Backwards-compatibility mode for the loader to automatically add '.js' extensions when not present to module requests.

This allows code written for SystemJS 0.16 or less to work easily in the latest version:

```javascript
System.defaultJSExtensions = true;

// requests ./some/module.js instead
System.import('./some/module');
```

Note that this is a compatibility property for transitioning to using explicit extensions and will be deprecated in future.

#### depCache
Type: `Object`

An alternative to bundling providing a solution to the latency issue of progressively loading dependencies.
When a module specified in depCache is loaded, asynchronous loading of its pre-cached dependency list begins in parallel.

```javascript
System.config({
  depCache: {
    moduleA: ['moduleB'], // moduleA depends on moduleB
    moduleB: ['moduleC'] // moduleB depends on moduleC
  }
});

// when we do this import, depCache knows we also need moduleB and moduleC,
// it then directly requests those modules as well as soon as we request moduleA
System.import('moduleA')
```

Over HTTP/2 this approach may be preferable as it allows files to be individually cached in the browser meaning bundle optimizations are no longer a concern.

#### map
Type: `Object`

The map option is similar to paths, but acts very early in the normalization process. It allows you to map a module alias to a
location or package:

```javascript
System.config({
  map: {
    jquery: '//code.jquery.com/jquery-2.1.4.min.js'
  }
});
```

```javascript
import $ from 'jquery';

```

In addition, a map also applies to any subpaths, making it suitable for package folders as well:

```javascript
System.config({
  map: {
    package: 'local/package'
  }
});
```

```javascript
// loads /local/package/path.js
System.import('package/path.js');
```

> Note map configuration used to support contextual submaps but this has been deprecated for package configuration.

#### meta
Type: `Object`
Default: `{}`

Module meta provides an API for SystemJS to understand how to load modules correctly.

Meta is how we set the module format of a module, or know how to shim dependencies of a global script.

```javascript
System.config({
  meta: {
    // meaning [baseURL]/vendor/angular.js when no other rules are present
    // path is normalized using map and paths configuration
    'vendor/angular.js': {
      format: 'global', // load this module as a global
      exports: 'angular', // the global property to take as the module value
      deps: [
        // dependencies to load before this module
        'jquery'
      ]
    }
  }
});
```

Wildcard meta is also supported and is additive from least to most specific match:

```javascript
System.config({
  meta: {
    '/vendor/*': { format: 'global' }
  }
});
```

* [`format`](module-formats.md):
  Sets in what format the module is loaded.
* [`exports`](module-formats.md#exports):
  For the `global` format, when automatic detection of exports is not enough, a custom exports meta value can be set.
  This tells the loader what global name to use as the module's export value.
* [`deps`](module-formats.md#shim-dependencies): 
  Dependencies to load before this module. Goes through regular paths and map normalization. Only supported for the `cjs`, `amd` and `global` formats.
* [`globals`](module-formats.md#custom-globals):
  A map of global names to module names that should be defined only for the execution of this module. 
    Enables use of legacy code that expects certain globals to be present. 
    Referenced modules automatically becomes dependencies. Only supported for the `cjs` and `global` formats.
* [`loader`](overview.md#plugin-loaders):
  Set a loader for this meta path.
* [`sourceMap`](creating-plugins.md):
  For plugin transpilers to set the source map of their transpilation.
* `nonce`: The [nonce](https://www.w3c.org/TR/CSP2/#script-src-the-nonce-attribute) attribute to use when loading the script as a way to enable CSP.
  This should correspond to the "nonce-" attribute set in the Content-Security-Policy header.
* `integrity`: The [subresource integrity](http://www.w3.org/TR/SRI/#the-integrity-attribute) attribute corresponding to the script integrity, describing the expected hash of the final code to be executed.
  For example, `System.config({ meta: { 'src/example.js': { integrity: 'sha256-e3b0c44...' }});` would throw an error if the translated source of `src/example.js` doesn't match the expected hash.
* `esmExports`: When loading a module that is not an ECMAScript Module, we set the module as the `default` export, but then also 
  iterate the module object and copy named exports for it a well. Use this option to disable this iteration and copying of the exports.

#### packages
Type: `Object`
Default: `{}`

Packages provide a convenience for setting meta and map configuration that is specific to a common path.

In addition packages allow for setting contextual map configuration which only applies within the package itself.
This allows for full dependency encapsulation without always needing to have all dependencies in a global namespace.

```javascript
System.config({
  packages: {
    // meaning [baseURL]/local/package when no other rules are present
    // path is normalized using map and paths configuration
    'local/package': {
      main: 'index.js',
      format: 'cjs',
      defaultExtension: 'js',
      map: {
        // use local jquery for all jquery requires in this package
        'jquery': './vendor/local-jquery.js',

        // import '/local/package/custom-import' should route to '/local/package/local/import/file.js'
        './custom-import': './local/import/file.js'
      },
      modules: {
        // sets meta for modules within the package
        'vendor/*': {
          'format': 'global'
        }
      }
    }
  }
});
```

* `main`: The main entry point of the package (so `import 'local/package'` is equivalent to `import 'local/package/index.js'`)
* `format`: The module format of the package. See [Module Formats](https://github.com/systemjs/systemjs/blob/master/docs/module-formats.md).
* `defaultExtension`: The default extension to add to modules requested within the package.
  Takes preference over defaultJSExtensions.
  Can be set to `defaultExtension: false` to optionally opt-out of extension-adding when `defaultJSExtensions` is enabled.
* `map`: Local and relative map configurations scoped to the package. Apply for subpaths as well.
* `modules`: Package-scoped meta configuration with wildcard support. Modules are subpaths within the package path.
  This also provides an opt-out mechanism for `defaultExtension`, by adding modules here that should skip extension adding.

#### paths
Type: `Object`

The [ES6 Module Loader](https://github.com/ModuleLoader/es6-module-loader/blob/master/docs/loader-config.md) paths implementation, applied after normalization and supporting subpaths via wildcards.

_It is usually advisable to use map configuration over paths unless you need strict control over normalized module names._

#### traceurOptions
Type: `Object`
Default: `{}`

Set the Traceur compilation options.

```javascript
System.config({
    traceurOptions: {
    }
});
```

A list of options is available in the [Traceur project documentation](https://github.com/google/traceur-compiler/wiki/Options-for-Compiling).

#### transpiler
Type: `String`
Default: `traceur`

Sets the module name of the transpiler to be used for loading ES6 modules.

Represents a module name for `System.import` that must resolve to either Traceur, Babel or TypeScript.

When set to `traceur`, `babel` or `typescript`, loading will be automatically configured as far as possible.

#### typescriptOptions
Type: `Object`
Default: `{}`

Sets the TypeScript transpiler options.

A list of options is available in the [TypeScript project documentation](https://github.com/Microsoft/TypeScript/wiki/Compiler%20Options).
