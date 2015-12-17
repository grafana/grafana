
## long-stack-http showcase

In this example we are demonstrating a few benefits that are apparent in the stack trace below.

  * We can see nice stack traces upon error (hello Java!), in this case
    when a connection is dropped.
  * The code is more readable - error handling is left to zones and not
    sprinkled all around.
  * Zones can be named dynamically, so additional information (the
    failing request URI in this example) shows up in the stack trace.

## What happens inside

demo.js creates an http server, and then creates a bunch of clients
that make POST requests to the server and try to send some data.

However the server has a chaos monkey inside it: sometimes it randomly
kills a connection. The client subsequently sees an 'ECONNRESET' error.
However that's okay: the zone takes care of the cleanup, and we print
long the stack trace (with one zone named after the URI we were posting
to) for debugging purposes.

Because the chaos monkey behaves randomly, you may not see an error on
every run and sometimes multiple errors may appear.

## Output

You'll end up seeing stack traces that look like this:

```
Error: read ECONNRESET
    at exports._errnoException (util.js:742:11)
    at TCP.onread (net.js:535:26)
    at Zone.self.apply (D:\zone\lib\Zone.js:438:23)
    at processQueues (D:\zone\lib\scheduler.js:52:12)
    at process._tickCallback (node.js:343:11)
In zone: POST http://127.0.0.1:3000/hello/7
    at Zone.create (D:\zone\lib\Zone.js:517:10)
    at Zone.ClientZone (D:\zone\showcase\long-stack-http\demo.js:85:10)
    at Zone.self.apply (D:\zone\lib\Zone.js:438:23)
    at Zone.self.run (D:\zone\lib\Zone.js:426:10)
    at new Zone (D:\zone\lib\Zone.js:504:10)
    at Zone.create (D:\zone\lib\Zone.js:517:10)
    at Object.<anonymous> (D:\zone\showcase\long-stack-http\demo.js:78:6)
    at Module._compile (module.js:449:26)
    at Object.Module._extensions..js (module.js:467:10)
    at Module.load (module.js:349:32)
In zone: ClientZone
    at Zone.create (D:\zone\lib\Zone.js:517:10)
    at Object.<anonymous> (D:\zone\showcase\long-stack-http\demo.js:78:6)
    at Module._compile (module.js:449:26)
    at Object.Module._extensions..js (module.js:467:10)
    at Module.load (module.js:349:32)
    at Function.Module._load (module.js:305:12)
    at Function.Module.runMain (module.js:490:10)
    at startup (node.js:124:16)
    at node.js:807:3
```
