### Module Formats

The following module formats are supported:

* `esm`: ECMAScript Module (previously referred to as `es6`)
* `cjs`: [CommonJS](#commonjs)
* `amd`: [Asynchronous Module Definition](#amd)
* `global`: [Global shim module format](#globals)
* `register`: [System.register](system-api.md#systemregister-name-deps-declare) or [System.registerDynamic](system-api.md#systemregisterdynamic-name-deps-executingrequire-declare) compatibility module format

The module format can be set via meta configuration:

```javascript
System.config({
  meta: {
    './module/path.js': {
      format: 'es6'
    }
  }
});
```

#### Module format detection

When the module format is not set, automatic regular-expression-based detection is used.
This module format detection is never completely accurate, but caters well for the majority use cases.

The module format detection happens in the following order:
* _System.register / System.registerDynamic_
  If the source code starts with a number of comments, followed by `System.register` or `System.registerDynamic` as the first line of code.
* _ES modules_
  The source is only detected as an ES module if it contains explicit module syntax - valid `import` or `export` statements.
* _AMD modules_
  The presence of a valid AMD `define` statement in the code.
* _CommonJS modules_
  The presence of `require(...)` or `exports` / `module.exports` assigments
* _Global_
  This is the fallback module format after all the above fail.

> Note that ES6 modules are detected via the presence of `import` and `export` module syntax and no other features at all. This is because the transpilation applies to the module format specifically, not the language.

#### Inter-Format Dependencies

Any module type can be loaded from any other type with full support thanks to [zebra-striping](https://github.com/ModuleLoader/es6-module-loader/blob/v0.17.0/docs/circular-references-bindings.md#zebra-striping).

When loading CommonJS, AMD or Global modules from within ES6, the full module is available at the `default` export which can be loaded with the default import syntax.

For convenience, named exports are also auto-populated but may not be correctly bound as expected, so use these carefully.

./app/es6-loading-commonjs:
```javascript
// entire underscore instance
import _ from './underscore.js';

// unbound named export
import {map} from './underscore.js';
```

### ES6

ES6 modules are automatically transpiled as they are loaded, using the loader [transpiler option](config-api.md#transpiler) set.

Circular references and bindings are implemented to the ES6 specification.

The `__moduleName` local variable is also available, pending clarification of the module meta in the WhatWG loader spec.

This provides the fully normalized name of the current module which can be useful for dynamically loading modules relative to the current module via:

```javascript
System.import('./local-module', __moduleName);
```

In due course this will be entirely replaced by the contextual loader once this has been specified.

_ES6 is loaded via XHR making it non-[CSP](http://www.html5rocks.com/en/tutorials/security/content-security-policy/) compatible. ES6 should always be built for production to avoid transpiler costs, making this a development-only feature._

### CommonJS

* The `module`, `exports`, `require`, `global`, `__dirname` and `__filename` variables are all provided.
* `module.id` is set.

When executing CommonJS any global `define` is temporarily removed.

For comprehensive handling of NodeJS modules, a conversion process is needed to make them SystemJS-compatible, such as the one used by jspm.

_CommonJS is loaded via XHR making it non-[CSP](http://www.html5rocks.com/en/tutorials/security/content-security-policy/) compatible._

### AMD

* AMD support includes all AMD structural variations including the [CommonJS wrapper form](http://requirejs.org/docs/api.html#cjsmodule).
* The special `module`, `exports`, and `require` module names are handled at the AMD format level and are not defined in the primary loader registry. `module.uri` and `module.id` are provided with `module.config` as a no-op.
* Named defines are supported and will write directly into the loader registry.
* A single named define will write into the loader registry but also be treated as the value of the module loaded if the names do not match. This enables loading a module containing `define('jquery', ...`.
* Contextual dynamic requires are fully supported (`define(function(require) {  require(['./dynamic/require'], callback) })`)

When executing AMD, the global `module`, `exports` are temporarily removed, and the global `define` and `require` are set to the SystemJS AMD functions.

_By default AMD modules are loaded via `<script>` tag injection making them [CSP](http://www.html5rocks.com/en/tutorials/security/content-security-policy/)-compatible, provided that modules that are AMD are indicated [via meta](#module-formats) so that SystemJS knows to skip format detection and load them with script tags._

#### RequireJS Support

To use SystemJS side-by-side in a RequireJS project, make sure to include RequireJS after ES6 Module Loader but before SystemJS.

Conversely, to have SystemJS provide a RequireJS-like API in an application set:

```javascript
window.define = System.amdDefine;
window.require = window.requirejs = System.amdRequire;
```

### Globals

The `global` format loads globals identically to if they were included via `<script>` tags 
but with some extra features including the ability to [shim dependencies](#shim-dependencies), 
set [custom globals](#custom-globals), and [define the exports](#exports) of the global module.

By default, the exports of a global are calculated as the diff of the environment global from before to after execution.

This provides a convenient mechanism for auto-conversion of globals into modules.

For example:

```javascript
var MyGlobal = 42;
```

Will get converted into the module `Module({ default: 42 })`.

While the script:

```javascript
(function(global) {
  global.globalA = 'global A';
  global.globalB = 'global B';
})(typeof self != 'undefined' ? self : global);
```

Will get converted into the module `Module({ globalA: 'global A', globalB: 'global B' })`

Globals are picked up by variable assignment and undeclared assignment:

```javascript
var x = 'global'; // detected as a global
y = 'global';     // detected as a global
```

These two cases fail in IE8, so do need to have their [exports explicitly declared](#exports) if compatibility is desired.

> Globals are not removed from the global object for shim compatibility, but this could become possible in future if all globals
use the [globals](#globals) meta for shims instead of [deps](#shim-dependencies).

#### Shim Dependencies

When loading plugins of globals like Angular or jQuery plugins, we always need to shim the dependencies of the plugin
to be dependent on the global it expects to find.

We do this via deps metadata on the module:

```javascript
System.config({
  meta: {
    'vendor/angular-ui-router.js': {
      deps: ['/vendor/angular.js']
    }
  }
});
System.import('vendor/angular-ui-router.js');
```

Note that deps is only supported for global modules.

> It is always advisable to explicitly shim global modules as above for any globals they expect to be present.
  For example, the above module may work fine without the shim if Angular always happens to load first in the page,
  but this isn't always guaranteed, and problems will likely be hit later on when the load order happens to change.

#### Custom Globals

When shimming dependencies, the issue with this is that every dependency needs to be a global in order to be loadable by a global.

This holds the entire ecosystem back as globals become the lowest common denominator.

If we want to upgrade Angular to an ES6 version of Angular, while still supporting old Angular global modules, we can do this via custom globals:

```javascript
System.config({
  meta: {
    'vendor/angular-ui-router.js': {
      globals: {
        angular: 'vendor/angular.js'
      }
    }
  }
});
System.import('vendor/angular-ui-router.js');
```

In the above scenario, a globally scoped `angular` will be set to the module value for the Angular ES6 module only for the duration of execution of the global plugin. They will be reverted to whatever they where before after execution, if they didn't exist they're removed. This doesn't influence the globals that might already be generated by the referenced package. 

> **The globals meta-configuration option is only available for the `global` and `cjs` module formats.** as these are the only formats that are source-code-transformation based.

Referenced packages automatically becomes dependencies. 

#### Exports

When automatic detection of exports is not enough, a custom exports meta value can be set.

This is a member expression on the global object to be taken as the exports of the module.

For example, `angular` or `jQuery.fn.pluginName`.

> Globals can be loaded in a way that is CSP-compatible by setting their `format` and `exports` metadata when not setting any `globals` metadata. SystemJS then knows it can use script tag injection for this case. For example, Google Analytics can be loaded without requiring CORS or CSP via setting:
  ```javascript
  System.config({
    meta: {
      'https://www.google-analytics.com/analytics.js': {
        exports: 'ga',
        format: 'global'
      }
    }
  });
  ```

