## SystemJS API

For setting SystemJS configuration see the [Configuration API](config-api.md) page.

#### System.amdDefine
Type: `Function`

For backwards-compatibility with AMD environments, set `window.define = System.amdDefine`.

#### System.amdRequire
Type: `Function`

For backwards-compatibility with AMD environments, set `window.require = System.amdRequire`.

#### System.config
Type: `Function`

SystemJS configuration helper function. See the [Configuration API](config-api.md).

#### System.constructor
Type: `Function`

This represents the System base class, which can be extended or reinstantiated to create a custom System instance.

Example:

```javascript
  var clonedSystem = new System.constructor();
  clonedSystem.baseURL = System.baseURL;
  clonedSystem.import('x'); // imports in a custom context
```

#### System.delete(moduleName)
Type: `Function`

Deletes a module from the registry by normalized name.

```javascript
System.delete('http://site.com/normalized/module/name.js');
```

#### System.get(moduleName) -> Module
Type: `Function`

Returns a module from the registry by normalized name.

```javascript
System.get('http://site.com/normalized/module/name.js').exportedFunction();
```

#### System.has(moduleName) -> Boolean
Type: `Function`

Returns whether a given module exists in the registry by normalized module name.

```javascript
if (System.has('http://site.com/normalized/module/name.js')) {
  // ...
}
```

#### System.import(moduleName [, normalizedParentName]) -> Promise(Module)
Type: `Function`

Loads a module by name taking an optional normalized parent name argument.

Promise resolves to the module value.

For loading relative to the current module, ES Modules define a `__moduleName` binding, so that:

```javascript
System.import('./local', __moduleName);
```

In CommonJS modules the above would be `module.id` instead.

This is non-standard, but coverse a use case that will be provided by the spec.

#### System.newModule(Object) -> Module
Type: `Function`

Given a plain JavaScript object, return an equivalent `Module` object.

Useful when writing a custom `instantiate` hook or using `System.set`.

#### System.register([name ,] deps, declare)
Type: `Function`

Declaration function for defining modules of the `System.register` polyfill module format.

[Read more on the format at the loader polyfill page](https://github.com/ModuleLoader/es6-module-loader/blob/v0.17.0/docs/system-register.md)

#### System.registerDynamic([name ,] deps, executingRequire, declare)
Type: `Function`

Companion module format to `System.register` for non-ES6 modules.

Provides a `<script>`-injection-compatible module format that any CommonJS or Global module can be converted into for CSP compatibility.

Output created by [SystemJS Builder](https://github.com/systemjs/builder) when creating bundles or self-executing bundles.

For example, the following CommonJS module:

```javascript
module.exports = require('pkg/module');
```

Can be written:

```javascript
System.registerDynamic(['pkg/module'], true, function(require, exports, module) {
  module.exports = require('pkg/module');
});
```

`executingRequire` indicates that the dependencies are executed synchronously only when using the `require` function, and not before execution.

* `require` is a standard CommonJS-style require
* `exports` the CommonJS exports object, which is assigned to the `default` export of the module, with its own properties available as named exports.
* `module` represents the CommonJS module object, with `export`, `id` and `url` properties set.

#### System.set(moduleName, Module)
Type: `Function`

Sets a module into the registry directly and synchronously.

Typically used along with `System.newModule` to create a valid `Module` object:

```javascript
System.set('custom-module', System.newModule({ prop: 'value' }));
```

> Note SystemJS stores all module names in the registry as normalized URLs. To be able to properly use the registry with `System.set` it is usually necessary to run `System.set(System.normalizeSync('custom-module'), System.newModule({ prop: 'value' }));` to ensure that `System.import` behaves correctly.

#### System._nodeRequire
Type: `Function`

In CommonJS environments, SystemJS will substitute the global `require` as needed by the module format being loaded to ensure
the correct detection paths in loaded code.

The CommonJS require can be recovered within these modules from `System._nodeRequire`.
