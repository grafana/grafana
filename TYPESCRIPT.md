(don't merge this file)

# Types / Declarations

Prefer explicitly importing types from packages and using them

```ts
import type { Whatever } from 'package-name';

function foo(arg: Whatever) {
  // ...
}
```

otherwise, if the type must be global, use a `/// <reference types="..." />` directive at the top of the file.

```ts
/// <reference types="systemjs" preserve="true" />

function foo(arg: System.Module) {
  // ...
}
```
