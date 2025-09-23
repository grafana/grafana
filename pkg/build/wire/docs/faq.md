# Frequently Asked Questions

## How does Wire relate to other Go dependency injection tools?

Other dependency injection tools for Go like [dig][] or [facebookgo/inject][]
are based on reflection. Wire runs as a code generator, which means that the
injector works without making calls to a runtime library. This enables easier
introspection of initialization and correct cross-references for tooling like
[guru][].

[dig]: https://github.com/uber-go/dig
[facebookgo/inject]: https://github.com/facebookgo/inject
[guru]: https://golang.org/s/using-guru

## How does Wire relate to other non-Go dependency injection tools (like Dagger 2)?

Wire's approach was inspired by [Dagger 2][]. However, it is not the aim of Wire
to emulate dependency injection tools from other languages: the design space and
requirements are quite different. For example, the Go compiler does not support
anything like Java's annotation processing mechanisms. The difference in
languages and their idioms necessarily requires different approaches in
primitives and API.

[Dagger 2]: https://google.github.io/dagger/

## Why use pseudo-functions to create provider sets or injectors?

In the early prototypes, Wire directives were specially formatted comments. This
seemed appealing at first glance as this meant no compile-time or runtime
impact. However, this unstructured approach becomes opaque to other tooling not
written for Wire. Tools like [`gorename`][] or [guru][] would not be able to
recognize references to the identifiers existing in comments without being
specially modified to understand Wire's comment format. By moving the references
into no-op function calls, Wire interoperates seamlessly with other Go tooling.

[`gorename`]: https://godoc.org/golang.org/x/tools/cmd/gorename

## What if my dependency graph has two dependencies of the same type?

This most frequently appears with common types like `string`. An example of this
problem would be:

```go
type Foo struct { /* ... */ }
type Bar struct { /* ... */ }

func newFoo1() *Foo { /* ... */ }
func newFoo2() *Foo { /* ... */ }
func newBar(foo1 *Foo, foo2 *Foo) *Bar { /* ... */ }

func inject() *Bar {
	// ERROR! Multiple providers for *Foo.
	wire.Build(newFoo1, newFoo2, newBar)
	return nil
}
```

Wire does not allow multiple providers for one type to exist in the transitive
closure of the providers presented to `wire.Build`, as this is usually a
mistake. For legitimate cases where you need multiple dependencies of the same
type, you need to invent a new type to call this other dependency. For example,
you can name OAuth credentials after the service they connect to. Once you have
a suitable different type, you can wrap and unwrap the type when plumbing it
through Wire. Continuing our above example:

```go
type OtherFoo Foo

func newOtherFoo() *OtherFoo {
	// Call the original provider...
	foo := newFoo2()
	// ...then convert it to the new type.
	return (*OtherFoo)(foo)
}

func provideBar(foo1 *Foo, otherFoo *OtherFoo) *Bar {
	// Convert the new type into the unwrapped type...
	foo2 := (*Foo)(otherFoo)
	// ...then use it to call the original provider.
	return newBar(foo1, foo2)
}

func inject() *Bar {
	wire.Build(newFoo1, newOtherFoo, provideBar)
	return nil
}
```

## Why does Wire forbid including the same provider multiple times?

Wire forbids this to remain consistent with the principle that specifying
multiple providers for the same type is an error. On the surface, Wire could
permit duplication, but this would introduce a few unintended consequences:

-  Wire would have to specify what kinds of duplicates are permissible: are two
   `wire.Value` calls ever considered to be the "same"?
-  If a provider set changes the function it uses to provide a type, then this
   could break an application, since it may introduce a new conflict between
   another provider set that was specifying the "same" provider.

As such, we decided that the simpler behavior would be for this case to be an
error, knowing we can always relax this restriction later. The user can always
create a new provider set that does not have the conflicting type. A [proposed
subtract command][] would automate the toil in this process.

[proposed subtract command]: https://github.com/google/wire/issues/8

## Why does Wire require explicitly declare that a type provides an interface type?

The reason the binding is explicit is to avoid scenarios where adding a new type
to the provider graph that implements the same interface causes the graph to
break, because that can be surprising. While this does result in more typing,
the end-effect is that the developer's intent is more explicit in the code,
which we felt was most consistent with the Go philosophy.

There is an [open issue](https://github.com/google/wire/issues/242) to consider
improving this.

## Should I use Wire for small applications?

Probably not. Wire is designed to automate more intricate setup code found in
larger applications. For small applications, hand-wiring dependencies is
simpler.

## Who is using Wire?

Wire is still fairly new and doesn't have a large user base yet. However, we
have heard a lot of interest from Go users wanting to simplify their
applications. If your project or company uses Wire, please let us know by either
emailing us or sending a pull request amending this section.
