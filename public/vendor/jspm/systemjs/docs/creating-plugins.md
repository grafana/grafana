### Creating a Plugin

A plugin is just a set of overrides for the loader hooks of the ES6 module specification.

The hooks plugins can override are `locate`, `fetch`, `translate` and `instantiate`.

Read more about loader extensions and hooks at the [ES6 Module Loader polyfill wiki](https://github.com/ModuleLoader/es6-module-loader/blob/v0.17.0/docs/loader-extensions.md).

The behavior of the hooks is:

* Locate: Overrides the location of the plugin resource
* Fetch: Called with third argument representing default fetch function, has full control of fetch output.
* Translate: Returns the translated source from `load.source`, can also set `load.metadata.sourceMap` for full source maps support.
* Instantiate: Providing this hook as a promise or function allows the plugin to hook instantiate. Any return value becomes the defined custom module object for the plugin call.

### Building Plugins

When building via [SystemJS Builder](https://github.com/systemjs/builder), plugins that use the translate hook will be inlined into the bundle automatically.

In this way, the bundle file becomes independent of the plugin loader and resource.

If it is desired for the plugin itself not to be inlined into the bundle in this way, setting `exports.build = false` on the plugin will disable this,
causing the plugin loader itself to be bundled in production instead to continue to dynamically load the resource.

#### Sample CoffeeScript Plugin

For example, we can write a CoffeeScript plugin with the following (CommonJS as an example, any module format works fine):

js/coffee.js:
```javascript
  var CoffeeScript = require('coffeescript');

  exports.translate = function(load) {
    // optionally also set the sourceMap to support both builds and in-browser transpilation
    // load.metadata.sourceMap = generatedSourceMap;
    return CoffeeScript.compile(load.source);
  }
```

By overriding the `translate` hook, we now support CoffeeScript loading with:

```
 - js/
   - coffee.js             our plugin above
   - coffeescript.js       the CoffeeScript compiler
 - app/
   - main.coffee
```

```javascript
  System.import('app/main.coffee!').then(function(main) {
    // main is now loaded from CoffeeScript
  });
```

Source maps can also be passed by setting `load.metadata.sourceMap`.

#### Sample CSS Plugin

A CSS plugin, on the other hand, could override the fetch hook:

js/css.js:
```javascript
  exports.fetch = function(load, fetch) {
    return new Promise(function(resolve, reject) {
      var cssFile = load.address;

      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssFile;
      link.onload = resolve;

      document.head.appendChild(link);
    })
    .then(function() {
      // return an empty module in the module pipeline itself
      return '';
    });
  }
```

Each loader hook can either return directly or return a promise for the value.

The other loader hooks are also treated otherwise identically to the specification.
