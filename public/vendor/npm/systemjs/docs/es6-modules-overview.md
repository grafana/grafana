## Background

### Modules and Module Loaders

A module is simply a JavaScript file written with module syntax. Modules _export_ values, which can then be _imported_ by other modules.

[CommonJS](http://wiki.commonjs.org/wiki/CommonJS) and [AMD](https://github.com/amdjs/amdjs-api/wiki/AMD) JavaScript files are modules.

A module loader provides the ability to dynamically load modules, and also keeps track of all loaded modules in a module registry.

Typically, in production, the module registry would be populated by an initial compiled bundle of modules. Later in the page state, it may become necessary to dynamically
load a new module. This module can then share dependencies with the initial page bundle without having to reload any dependencies.

Module code is treated differently to scripts due to the nature of exports and imports. 
This is why the `<script type="module">` tag is introduced to distinguish script code from module code.

### Module Naming

Normalization rules allow module names to be converted into URLs.

This allows module aliases like `import $ from 'jquery'` to be equivalent to writing `import $ from 'https://code.jquery.com/jquery.js'`

Normalization rules are specific to the module loader implementation, with some certain standard conventions set down by the browser loader specification.

## ES6 Module Syntax

### Exporting

ES6 module syntax is most similar to the `exports.method = function() {}` pattern in NodeJS of creating multiple named exports.

In CommonJS one might write:

```javascript
  exports.someMethod = function() {

  };

  exports.another = {};
```

In ES6, this same code would be written:

exporter.js:
```javascript
  export function someMethod() {

  }

  export var another = {};
```

Notice that the name of the function, class or variable gets used as the export name.

### Importing

When importing, we import any exports we need by name, and can also choose to rename them:

importer.js:
```javascript
  import { someMethod, another as newName } from './exporter';

  someMethod();
  typeof newName == 'object';
```

### Default Import and Export

Sometimes one doesn't want to write an import name at all. For this we can use the default export:

export-default.js:
```javascript
  export default function foo() {
    console.log('foo');
  }
```

import-default.js:
```javascript
  import customName from './export-default';

  customName(); // -> 'foo'
```

### All Supported Syntax

There are a few other variations of module syntax, the full list of supported statements is listed below.

```javascript
import 'jquery';                        // import a module without any import bindings
import $ from 'jquery';                 // import the default export of a module
import { $ } from 'jquery';             // import a named export of a module
import { $ as jQuery } from 'jquery';   // import a named export to a different name

export var x = 42;                      // export a named variable
export function foo() {};               // export a named function

export default 42;                      // export the default export
export default function foo() {};       // export the default export as a function

export { encrypt };                     // export an existing variable
export { decrypt as dec };              // export a variable as a new name
export { encrypt as en } from 'crypto'; // export an export from another module
export * from 'crypto';                 // export all exports from another module
                                        // (except the default export)
import * as crypto from 'crypto';       // import an entire module instance object
```

Note that any valid declaration can be exported. In ES6, this includes `class` (as in the example above), `const`, and `let`.