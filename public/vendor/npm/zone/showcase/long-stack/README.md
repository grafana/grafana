
## Long-stack showcase

This showcase demonstrates that zones can print out long stack traces,
and that zones can be named dynamically so the programmer can add
additional information that shows up in the stack trace.

In long-stack.js a couple of (nested) zones are created and some
asynchronous APIs are used (nextTick and setTimeout). Eventually a
non-existent function is called which causes an error to be thrown. Node
crashes with a long stack trace.

You can run short-stack.js if you want to be reminded what this looks
like without zones.

## Output

The long stack trace should look similar to this:

```
ReferenceError: function_that_doesnt_exist is not defined
    at Zone.<anonymous> (D:\zone\showcase\long-stack\long-stack.js:20:5)
    at Zone.self.apply (D:\zone\lib\Zone.js:440:23)
    at processQueues (D:\zone\lib\scheduler.js:52:12)
    at process._tickCallback (node.js:343:11)
In zone: AsyncFailZone
    at D:\zone\lib\Zone.js:532:12
    at Zone.<anonymous> (D:\zone\showcase\long-stack\long-stack.js:14:5)
    at Zone.self.apply (D:\zone\lib\Zone.js:440:23)
    at Zone.self.run (D:\zone\lib\Zone.js:428:10)
    at new Zone (D:\zone\lib\Zone.js:506:10)
    at Zone.create (D:\zone\lib\Zone.js:519:10)
    at Zone.createMiddleZone (D:\zone\showcase\long-stack\long-stack.js:12:8)
    at Zone.self.apply (D:\zone\lib\Zone.js:440:23)
    at Gate.self.apply (D:\zone\lib\Gate.js:62:12)
    at Gate.self.run (D:\zone\lib\Gate.js:53:10)
In zone: In the middle
    at Zone.create (D:\zone\lib\Zone.js:519:10)
    at Zone.createMiddleZone (D:\zone\showcase\long-stack\long-stack.js:12:8)
    at Zone.self.apply (D:\zone\lib\Zone.js:440:23)
    at Gate.self.apply (D:\zone\lib\Gate.js:62:12)
    at Gate.self.run (D:\zone\lib\Gate.js:53:10)
    at D:\zone\lib\process.js:19:10
    at process._tickCallback (node.js:343:11)
    at Function.Module.runMain (module.js:492:11)
    at startup (node.js:124:16)
    at node.js:807:3
In zone: Outer
    at Zone.create (D:\zone\lib\Zone.js:519:10)
    at Object.<anonymous> (D:\zone\showcase\long-stack\long-stack.js:7:6)
    at Module._compile (module.js:449:26)
    at Object.Module._extensions..js (module.js:467:10)
    at Module.load (module.js:349:32)
    at Function.Module._load (module.js:305:12)
    at Function.Module.runMain (module.js:490:10)
    at startup (node.js:124:16)
    at node.js:807:3
```
