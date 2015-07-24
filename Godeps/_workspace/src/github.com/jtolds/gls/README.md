gls
===

Goroutine local storage

### IMPORTANT NOTE ###

It is my duty to point you to https://blog.golang.org/context, which is how 
Google solves all of the problems you'd perhaps consider using this package
for at scale. 

One downside to Google's approach is that *all* of your functions must have
a new first argument, but after clearing that hurdle everything else is much
better.

If you aren't interested in this warning, read on.

### Huhwaht? Why? ###

Every so often, a thread shows up on the
[golang-nuts](https://groups.google.com/d/forum/golang-nuts) asking for some
form of goroutine-local-storage, or some kind of goroutine id, or some kind of
context. There are a few valid use cases for goroutine-local-storage, one of
the most prominent being log line context. One poster was interested in being
able to log an HTTP request context id in every log line in the same goroutine
as the incoming HTTP request, without having to change every library and
function call he was interested in logging.

This would be pretty useful. Provided that you could get some kind of
goroutine-local-storage, you could call
[log.SetOutput](http://golang.org/pkg/log/#SetOutput) with your own logging
writer that checks goroutine-local-storage for some context information and
adds that context to your log lines.

But alas, Andrew Gerrand's typically diplomatic answer to the question of
goroutine-local variables was:

> We wouldn't even be having this discussion if thread local storage wasn't
> useful. But every feature comes at a cost, and in my opinion the cost of
> threadlocals far outweighs their benefits. They're just not a good fit for
> Go.

So, yeah, that makes sense. That's a pretty good reason for why the language
won't support a specific and (relatively) unuseful feature that requires some
runtime changes, just for the sake of a little bit of log improvement.

But does Go require runtime changes?

### How it works ###

Go has pretty fantastic introspective and reflective features, but one thing Go
doesn't give you is any kind of access to the stack pointer, or frame pointer,
or goroutine id, or anything contextual about your current stack. It gives you
access to your list of callers, but only along with program counters, which are
fixed at compile time.

But it does give you the stack.

So, we define 16 special functions and embed base-16 tags into the stack using
the call order of those 16 functions. Then, we can read our tags back out of
the stack looking at the callers list.

We then use these tags as an index into a traditional map for implementing
this library.

### What are people saying? ###

"Wow, that's horrifying."

"This is the most terrible thing I have seen in a very long time."

"Where is it getting a context from? Is this serializing all the requests? 
What the heck is the client being bound to? What are these tags? Why does he 
need callers? Oh god no. No no no."

### Docs ###

Please see the docs at http://godoc.org/github.com/jtolds/gls

### Related ###

If you're okay relying on the string format of the current runtime stacktrace 
including a unique goroutine id (not guaranteed by the spec or anything, but 
very unlikely to change within a Go release), you might be able to squeeze 
out a bit more performance by using this similar library, inspired by some 
code Brad Fitzpatrick wrote for debugging his HTTP/2 library: 
https://github.com/tylerb/gls (in contrast, jtolds/gls doesn't require 
any knowledge of the string format of the runtime stacktrace, which 
probably adds unnecessary overhead).
