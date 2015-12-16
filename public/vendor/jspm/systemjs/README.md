SystemJS
========

[![Build Status][travis-image]][travis-url]
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/systemjs/systemjs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 
[![Tips](https://tips.60devs.com/images/button-black.svg)](https://tips.60devs.com/tip/33df4abbec4d39260f49015d2457eafe)

_For upgrading to SystemJS 0.17-0.19, see the [SystemJS 0.17 release upgrade notes for more information](https://github.com/systemjs/systemjs/releases/tag/0.17.0), or read the updated [SystemJS Overview](docs/overview.md) guide._

Universal dynamic module loader - loads ES6 modules, AMD, CommonJS and global scripts in the browser and NodeJS. Works with both Traceur and Babel.

* [Loads any module format](docs/module-formats.md) with [exact circular reference and binding support](https://github.com/ModuleLoader/es6-module-loader/blob/v0.17.0/docs/circular-references-bindings.md).
* Loads [ES6 modules compiled into the `System.register` bundle format for production](docs/production-workflows.md), maintaining circular references support.
* Supports RequireJS-style [map](docs/overview.md#map-config), [paths](docs/overview.md#paths-config), [bundles](docs/production-workflows.md#bundle-extension) and [global shims](docs/module-formats.md#shim-dependencies).
* [Loader plugins](docs/overview.md#plugin-loaders) allow loading assets through the module naming system such as CSS, JSON or images.

Built on top of the [ES6 Module Loader polyfill](https://github.com/ModuleLoader/es6-module-loader).

~15KB minified and gzipped, runs in IE8+ and NodeJS.

For discussion, [see the Google Group](https://groups.google.com/group/systemjs).

For a list of guides and tools, see the [Third-Party Resources Wiki](https://github.com/systemjs/systemjs/wiki/Third-Party-Resources).

Documentation
---

* [ES6 Modules Overview](docs/es6-modules-overview.md)
* [SystemJS Overview](docs/overview.md)
* [Config API](docs/config-api.md)
* [Module Formats](docs/module-formats.md)
* [Production Workflows](docs/production-workflows.md)
* [System API](docs/system-api.md)
* [Creating Plugins](docs/creating-plugins.md)

Basic Use
---

### Browser

```html
<script src="system.js"></script>
<script>
  // set our baseURL reference path
  System.config({
    baseURL: '/app'
  });

  // loads /app/main.js
  System.import('main.js');
</script>
```

To load ES6, locate a transpiler ([`traceur.js`](https://github.com/jmcriffey/bower-traceur), ['browser.js' from Babel](https://github.com/babel/babel), or ['typescript.js' from TypeScript](https://github.com/Microsoft/TypeScript)) 
in the baseURL path, then set the transpiler:

```html
<script>
  System.config({
    // or 'traceur' or 'typescript'
    transpiler: 'babel',
    // or traceurOptions or typescriptOptions
    babelOptions: {

    }
  });
</script>
```

Alternatively a custom path to Babel or Traceur can also be set through paths:

```javascript
System.config({
  map: {
    traceur: 'path/to/traceur.js'
  }
});
```

### Polyfills

SystemJS relies on `Promise` and `URL` being present in the environment. When these are not available it will send a request out to the `system-polyfills.js` file located in the dist folder which will polyfill `window.Promise` and `window.URLPolyfill`.

This is typically necessary in IE, so ensure to keep this file in the same folder as SystemJS.

Alternatively these polyfills can be loaded with a script tag before SystemJS or via other polyfill implementations as well.

### NodeJS

To load modules in NodeJS, install SystemJS with:

```
  npm install systemjs
```

If transpiling ES6, also install the transpiler:

```
  npm install traceur babel typescript 
```

We can then load modules equivalently to in the browser:

```javascript
var System = require('systemjs');

System.transpiler = 'traceur';

// loads './app.js' from the current directory
System.import('./app.js').then(function(m) {
  console.log(m);
});
```

If using TypeScript, set `global.ts = require('typescript')` before importing to ensure it is loaded correctly.

If you are using jspm as a package manager you will also need to load the generated `config.js`. The best way to do this in node is to get your `System` instance through jspm, which wil automatically load your config correctly for you:

```js
var System = require('jspm').Loader();

System.import('lodash').then(function (_) {
 console.log(_);
});
```

### Plugins

Supported loader plugins:

* [CSS](https://github.com/systemjs/plugin-css) `System.import('my/file.css')`
* [Image](https://github.com/systemjs/plugin-image) `System.import('some/image.png!image')`
* [JSON](https://github.com/systemjs/plugin-json) `System.import('some/data.json')`
* [Text](https://github.com/systemjs/plugin-text) `System.import('some/text.txt!text')`

Additional Plugins:

* [Audio](https://github.com/ozsay/plugin-audio) `System.import('./beep.mp3!audio')`
* [CoffeeScript](https://github.com/forresto/plugin-coffee) `System.import('./test.coffee')`
* [Jade](https://github.com/johnsoftek/plugin-jade)
* [Jade VirtualDOM](https://github.com/WorldMaker/system-jade-virtualdom)
* [JSX](https://github.com/floatdrop/plugin-jsx) `System.import('template.jsx')`
* [Markdown](https://github.com/guybedford/plugin-md) `System.import('app/some/project/README.md').then(function(html) {})`
* [WebFont](https://github.com/guybedford/plugin-font) `System.import('google Port Lligat Slab, Droid Sans !font')`
* [Handlebars](https://github.com/davis/plugin-hbs) `System.import('template.hbs!')`
* [Ember Handlebars](https://github.com/n-fuse/plugin-ember-hbs) `System.import('template.hbs!')`
* [raw](https://github.com/matthewbauer/plugin-raw) `System.import('file.bin!raw').then(function(data) {})`
* [jst](https://github.com/podio/plugin-jst) Underscore templates
* [SASS](https://github.com/screendriver/plugin-sass) `System.import('style.scss!')`

[Read about using plugins here](docs/overview.md#plugin-loaders)
[Read the guide here on creating plugins](docs/creating-plugins.md).

#### Running the tests

To install the dependencies correctly, run `bower install` from the root of the repo, then open `test/test.html` in a browser with a local server
or file access flags enabled.

License
---

MIT

[travis-url]: https://travis-ci.org/systemjs/systemjs
[travis-image]: https://travis-ci.org/systemjs/systemjs.svg?branch=master
