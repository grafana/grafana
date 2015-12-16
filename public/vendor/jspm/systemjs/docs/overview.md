### Loading Modules

Any URL can be loaded as a module with standard URL syntax:

```html
<script src="system.js"></script>
<script>
  // loads relative to the current page URL
  System.import('./local-module.js'); 

  // load from an absolute URL directly
  System.import('https://code.jquery.com/jquery.js');
</script>
```

Any type of module format can be loaded and it will be detected automatically by SystemJS.

##### File access from files

> _Note that when running locally, ensure you are running from a local server or a browser with local XHR requests enabled. If not you will get an error message._

> _For Chrome on Mac, you can run it with: `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --allow-file-access-from-files &> /dev/null &`_

> _In Firefox this requires navigating to `about:config`, entering `security.fileuri.strict_origin_policy` in the filter box and toggling the option to false._

### Loading ES6

app/es6-file.js:
```javascript
  export class q {
    constructor() {
      this.es6 = 'yay';
    }
  }
```

```html
  <script>
    System.import('./app/es6-file.js').then(function(m) {
      console.log(new m.q().es6); // yay
    });
  </script>
```

ES6 modules define named exports, provided as getters on a special immutable `Module` object.

* [Read more about ES6 modules and syntax](es6-modules-overview.md).
* To build for production, see the [production workflows](production-workflows.md).
* [Read more about SystemJS module format support](module-formats.md).

### Loader Configuration

Some of the standard configuration options and their use cases are described below.

For a reference see the [Config API](config-api.md) page.

#### baseURL

The *baseURL* provides a special mechanism for loading modules relative to a standard reference URL.

This can be useful for being able to refer to the same module from many different page URLs or environments:

```javascript
System.config({
  baseURL: '/modules'
});


// loads /modules/jquery.js
System.import('jquery.js');
```

Module names of the above form are referred to as _plain names_ and are always loaded baseURL-relative instead of
parentURL relative like one would expect with ordinary URLs.

> Note we always run the `System.config` function instead of setting instance properties directly as this will set the correct normalized baseURL in the process.

#### Map Config

The baseURL is very useful for providing an absolute reference URL for loading all modules, but we don't necessarily want to
have to locate every single shared dependency from within one folder.

Sometimes we want to load things from different places.

Map configuration is useful here to be able to specific exactly where to locate a given package:

```javascript
System.config({
  map: {
    jquery: 'https://code.jquery.com/jquery.js'
  }
});
```

Map configuration can also be used to map subpaths:

```javascript
System.config({
  map: {
    app: '/app/'
  }
});

// will load /app/main.js
System.import('app/main.js');
```

Map configuration is always applied before the baseURL rule in the loader.

### Plugin Loaders

Plugins handle alternative loading scenarios, including loading assets such as CSS or images, and providing custom transpilation scenarios.

Plugins can also inline into bundles or remain separate requests when using [SystemJS Builder](https://github.com/systemjs/builder).

To create a custom plugin, see the documentation on [creating plugins](creating-plugins.md).

#### Basic Use

> Note that if using the `defaultJSExtensions` compatibility feature, plugins for resources with custom extensions will only work by using the [package configuration](config-api.md#packages) `defaultExtension: false` option to override this for specific packages.

To use a plugin, set up the plugin itself as a standard module, either locating it in the baseURL or providing map configuration for it.

In this case, we're using the [text plugin](https://github.com/systemjs/plugin-text) as an example.

Then configure a custom resource to be loaded via the plugin, we then use meta configuration:

```javascript
System.config({
  // locate the plugin via map configuration
  // (alternatively have it in the baseURL)
  map: {
    text: '/path/to/text-plugin.js'
  },
  // use meta configuration to reference which modules
  // should use the plugin loader
  meta: {
    'templates/*.html': {
      loader: 'text'
    }
  }
});
```

Now any code that loads from `[baseURL]/templates/*.html` will use the text loader plugin and return the loaded content:

app.js
```javascript
import htmlSource from 'templates/tpl.html';

document.querySelector('.container').innerHTML = htmlSource;
```

When we build app.js, the text plugin will then automatically inline the templates into the bundle during the build.

#### Plugin Syntax

It is also possible to use syntax to load via plugins instead of configuration:

```javascript
System.import('some/file.txt!text')
```

When no plugin is explicitly specified the extension is used as the plugin name itself.

> Note it is usually advisable to use plugin loader configuration over plugin syntax.
