# StrongLoop zone library

## Overview

The Zone library provides a way to represent the dynamic extent of asynchronous calls in Node. Just like the scope of a function defines where it may be used, the extent of a call represents the lifetime that is it active.

A Zone also provides execution context that can persist across the lifecycle of one or more asynchronous calls. This is similar to the concept of thread-local data in Java.

Zones provide a way to group and track resources and errors across asynchronous operations. In addition zones:

  * Enables more effective debugging by providing better stack traces for asynchronous functions
  * Makes it easier to write and understand asynchronous functions for Node applications
  * Makes it easier to handle errors raised asynchronously and avoid resulting resource leaks
  * Enables you to associate user data with asynchronous control flow
  
[Dart's async library](https://api.dartlang.org/apidocs/channels/stable/dartdoc-viewer/dart-async.Zone) and [Brian Ford's zone.js](https://github.com/btford/zone.js/) library provide similar functionality.

## Implementation status

* The zone library and documentation are still under development: there are bugs, missing features, and limited documentation.

* The zone library dynamically modifies Node's asynchronous APIs at runtime.
  As detailed below, some of the modules have not yet been completed, and thus you cannot use them with zones.
  
  The following modules have not been zone enabled:
  
  - cluster
  - crypto: `pbkdf2`, `randomBytes`, `pseudoRandomBytes`
  - fs: `fs.watch`, `fs.watchFile`, `fs.FSWatcher`
  - process object: `process.on('SIGHUP')` and other signals.
  - tls / https
  - udp
  - zlib

## Using zones

To use zones, add the following as the very first line of your program:

```js
require('zone').enable();
```

The zone library exports a global variable, `zone`. The `zone` global variable always refers to the currently active zone. Some methods that can always be found on the 'zone' object are actually static methods of the `Zone` class, so they don't do anything with the currently active zone.

After loading the zone library the program has entered the 'root' zone.

### Creating a zone

There are a few different ways to create a zone. The canonical way to create a one-off zone is:

```js
// Load the library
require('zone').enable();

// MyZone is the name of this zone which shows up in stack traces.
zone.create(function MyZone() {
  // At this point the 'zone' global points at the zone instance ("MyZone")
  // that we just created.
});
```

The zone constructor function is called synchronously.

#### Defining zone functions

Under some circumstances it may be desirable to create a function that is always wrapped within a zone.
The obvious way to do this:

```js
function renderTemplate(fileName, cb) {
  zone.create(function() {
    // Actual work here
    ...
  }).setCallback(cb);
}
```

To make this a little less verbose there is the 'zone.define()' API.
With it you can wrap a function such that when it's called a zone is created.
Example:

```js
var renderTemplate = zone.define(function(fileName, cb) {
  zone.setCallback(cb);
  // Actual work here
  ...
});
```

Now you can use this zone template as follows:

```js
renderTemplate('bar', function(err, result) {
  if (err)
    throw err;
  // Do something with the result
  ...
});
```

### Obtaining the result of a zone

Zones are like asynchronous functions. From the outside perspective, they can return a single value or "throw" a single error. There are a couple of ways the outside zone may obtain the result of a zone. When a zone reports its outcome:

  * No more callbacks will run inside the zone.
  * All non-garbage-collectable resources have been cleaned up.

Zones also automatically exit when no explicit value is returned.

A way to obtain the outcome of a zone is:

```js
require('zone').enable();
var net = require('net');

zone.create(function MyZone() {
  // This runs in the context of MyZone
  net.createConnection(...);
  fs.stat(...)

  if (Math.random() < 0.5)
    throw new Error('Chaos monkey!');
  else if (Math.random() < 0.5)
    zone.return('Chaos monkey in disguise!');
  else
    ; // Wait for the zone to auto-exit.

}).setCallback(function(err, result) {
  // Here we're back in the root zone.
  // Asynchronicity is guaranteed, even if the zone returns or throws immediately.
  // By the time we get here we are sure:
  //   * the connection has been closed one way or another
  //   * fs.stat has completed
});
```

You can also use the `then` and `catch` methods, as if it were a promise.
Note that unlike promises you can't currently chain calls callbacks.

```js
zone.create(function MyZone() {
  // Do whatever
}).then(function(result) {
  // Runs when succesful
}).catch(function(err) {
  // Handle error
});
```

### Sharing resources between zones

Within a zone you may use resources that are "owned" by ancestor zones. So this is okay:

```js
var server = http.createServer().listen(1234);
server.listen(1234);

zone.create(function ServerZone() {
  // Yes, allowed.
  server.on('connection', function(req, res) { ... });

  // Totally okay
  process.stdout.write('hello!');
});
```

However, using resources owned by child zones is not allowed:

```js
var server;

zone.create(function SomeZone() {
 server = http.createServer().listen(1234);
});

// NOT OKAY!
server.on('connection', function() { ... });
```

NOTE: Currently zones don't always enforce these rules, but you're not supposed to do this. It would also be dumb, since the server will disappear when `SomeZone()` exits itself!

### The rules of engagement

It is okay for a zone to temporarily enter an ancestor zone. It is not
allowed to enter child zones, siblings, etc. The rationale behind this is
that when a zone is alive its parent must also be alive. Other zones
may exit unless they are aware that code will run inside them.

```js
zone.create(function OuterZone() {
  var childZone = zone.create(function ChildZone() {
    ...
  });

  // Fine.
  zone.parent.run(function() {
    console.log('Hello from the root zone!');
  });

  // NOT ALLOWED
  childZone.run(function() {
    console.log('Weird. This isn't supposed to work!');
  });
});
```

### Exiting a zone

There are a few ways to explicitly exit a zone:

* `zone.return(value)` sets the return value of the zone and starts cleanup.
* `zone.throw(error)` sets the zone to failed state and starts cleanup. `zone.throw` itself does not throw, so statements after it will run.
* `throw error` uses normal exception handling. If the exception is not caught before it reaches the binding layer, the active zone is set to failed state and starts cleanup.
* `zone.complete(err, value)` is a zone-bound function that may be passed to subordinates to let them exit the zone.

A rather pointless example:

```js
zone.create(function StatZone() {
  fs.stat('/some/file', function(err, result) {
    if (err)
      throw err;
    else
      zone.return(result);
  });
});
```

This is equivalent to:

```js
zone.create(function StatZone() {
  fs.stat('/some/file', zone.complete);
});
```

To run code in a child zone, you can use `zone.bindCallback` and `zone.bindAsyncCallback` to create a callback object which can be invoked from a parent zone.

### Sharing resources between zones

Within a zone you may use resources that are "owned" by ancestor zones. So this is okay:

```js
var server = http.createServer().listen(1234);
server.listen(1234);

zone.create(function ServerZone() {
  // Yes, allowed.
  server.on('connection', function(req, res) { ... });

  // Totally okay
  process.stdout.write('hello!');
});
```

However, using resources owned by child zones is not allowed:

```js
var server;

zone.create(function SomeZone() {
 server = http.createServer().listen(1234);
});

// NOT OKAY!
server.on('connection', function() { ... });
```

NOTE: Currently zones don't always enforce these rules, but you're not supposed to do this.
It would also be dumb, since the server will disappear when `SomeZone()` exits itself!

### Zone.data

zone.data is a magical property that that associates arbitrary data with a zone.
In a way you can think of it as the 'scope' of a zone. Properties that are not explicitly defined within the scope of a zone are inherited from the parent zone.

  * In the root zone, `zone.data` equals the global object.
  * In any other zone, `zone.data` starts off as an empty object with the parent zone's `data` property as it's prototype.
  * In other words, `zone.data.__proto__ === zone.parent.data`.
