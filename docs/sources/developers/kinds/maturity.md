---
keywords:
- grafana
- schema
- maturity
title: Grafana Kinds - From Zero to Maturity
weight: 300
---

# Grafana Kinds - From Zero to Maturity

> Grafana’s schema, Kind, and related codegen systems are under intense development.

Fear of unknown impacts leads to defensive coding, slow PRs, circular arguments, and an overall hesitance to engage. 
That friction alone is sufficient to sink a large-scale project. This guide seeks to counteract this friction by 
defining an end goal for all schemas: “mature.” This is the word we’re using to refer to the commonsense notion of “this
software reached 1.0.”

In general, 1.0/mature suggests: “we’ve thought about this thing, done the necessary experimenting, know what it is, and
feel confident about presenting it to the world.” In the context of schemas intended to act as a single source of truth 
driving many use cases, we can intuitively phrase maturity as:

- The schema follows general best practices (e.g. good comments, follows field type rules), and the team owning the 
schema believes that the fields described in the schema are accurate.
- Automation propagates the schema as source of truth to every relevant 
[domain](https://docs.google.com/document/d/13Rv395_T8WTLBgdL-2rbXKu0fx_TW-Q9yz9x6oBjm6g/edit#heading=h.67pop2k2f8fq) 
(for example: types in frontend, backend, as-code; plugins SDK; docs; APIs and storage; search indexing)

This intuitive definition gets us pointed in the right direction. But we can’t just jump straight there - we have to 
approach it methodically. To that end, this doc outlines four (ok five, but really, four) basic maturity milestones that
we expect Kinds and their schemas to progress through:

- *(Planned - Put a Kind name on the official TODO list)*
- **Merged** - Get an initial schema written down. Not final. Not perfect.
- **Experimental** - Kind schemas are the source of truth for basic working code.
- **Stable** - Kind schemas are the source of truth for all target domains.
- **Mature** - The operational transition path for the Kind is battle-tested and reliable.

These milestones have functional definitions, tied to code and enforced in CI. A Kind having reached a particular 
milestone corresponds to properties of the code that are enforced in CI; advancing to the next milestone likely has a 
direct impact on code generation and runtime behavior.

Finally, the above definitions imply that maturity for *individual Kinds/schemas* depends on *the Kind system* being 
mature, as well. This is by design: **Grafana Labs does not intend to publicize any single schema as mature until 
[certain schema system milestones are met](https://github.com/orgs/grafana/projects/133/views/8).**

## Schema Maturity Milestones

Maturity milestones are a linear progression. Each milestone implies that the conditions of its predecessors continue to
be met. 

Reaching a particular milestone implies that the properties of all prior milestones are still met.

### (Milestone 0 - Planned) {#planned}

| **Goal**                     | Put a Kind name on the official TODO list: [Kind Schematization Progress Tracker](https://docs.google.com/spreadsheets/d/1DL6nZHyX42X013QraWYbKsMmHozLrtXDj8teLKvwYMY/edit#gid=0) |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Reached when**             | The planned Kind is listed in the relevant sheet of the progress tracker with a link to track / be able to see when exactly it is planned and who is responsible for doing it     |
| **Common hurdles**           | Existing definitions may not correspond clearly to an object boundary - e.g. playlists are currently in denormalized SQL tables playlist and playlist_item                        |
| **Public-facing guarantees** | None                                                                                                                                                                              |
| **customer-facing stage**    | None                                                                                                                                                                              |

### Milestone 1 - Merged {#merged}

| **Goal**                     | Get an initial schema written down. Not final. Not perfect.                                                                                                                                                                   |
|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Reached when**             | A PR introducing the initial version of a schema has been merged.                                                                                                                                                             |
| **Common hurdles**           | Getting comfortable with Thema and CUE<br/>Figuring out where all the existing definitions of the Kind are<br/>Knowing whether it’s safe to omit possibly-crufty fields from the existing definitions when writing the schema |
| **Public-facing guarantees** | None                                                                                                                                                                                                                          |
| **User-facing stage**        | None                                                                                                                                                                                                                          |

### Milestone 2 - Experimental {#experimental}

| **Goal**                     | Schemas are the source of truth for basic working code.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Reached when**             | Go and TypeScript types generated from schema are used in all relevant production code, having replaced handwritten type definitions (if any).                                                                                                                                                                                                                                                                                                                                              |
| **Common hurdles**           | Compromises on field definitions that seemed fine to reach “committed” start to feel unacceptable<br/>Ergonomics of generated code may start to bite<br/>Aligning with the look and feel of related schemas                                                                                                                                                                                                                                                                                 |
| **Public-facing guarantees** | Kinds are available for as-code usage in [grok](https://github.com/grafana/grok), and in tools downstream of grok, following all of grok’s standard patterns.                                                                                                                                                                                                                                                                                                                               |
| **Stage comms**              | Internal users:- Start using the schema and give feedback internally to help move to the next stage.External users:- Align with the [experimental](https://docs.google.com/document/d/1lqp0hALax2PT7jSObsX52EbQmIDFnLFMqIbBrJ4EYCE/edit#heading=h.ehl5iy7pcjvq) stage in the release definition document.  - Experimental schemas will be discoverable, and from a customer PoV should never be used in production, but they can be explored and we are more than happy to receive feedback |


## Schema-writing guidelines

### Avoid anonymous nested structs

***Always name your sub-objects.***

In CUE, nesting structs is like nesting objects in JSON, and just as easy:
~~~ json                                     
one: {
  two: {
    three: {
  }
}
~~~

While these can be accurately represented in other languages, they aren’t especially friendly to work with:

~~~ typescript
// TypeScript
export interface One {
  two: {
    three: string;
  };
}
~~~

~~~ go
// Go
type One struct {
  Two struct {
    Three string `json:"three"`
  } `json:"two"`
}
~~~

Instead, within your schema, prefer to make root-level definitions with the appropriate attributes:

~~~ cue
// Cue
one: {
  two: #Two
  #Two: {
    three: string
  } @cuetsy(kind="interface")
}
~~~

~~~ Typescript
// TypeScript
export interface Two {
  three: string;
}
export interface One {
  two: Two;
}
~~~

~~~ Go
// Go
type One struct {
  Two Two `json:"two"`
}
type Two struct {
  Three string `json:"three"`
}
~~~

### Use precise numeric types

***Use precise numeric types like `float64` or `uint32`. Never use `number`.***

Never use `number` for a numeric type in a schema.

Instead, use a specific, sized type like `int64` or `float32`. This makes your intent precisely clear.
TypeScript will still represent these fields with `number`, but other languages (e.g. Go, Protobuf) can be more precise.

Unlike in Go, int and uint are not your friends. These correspond to `math/big` types. Use a sized type,
like `uint32` or `int32`, unless the use case specifically requires a huge numeric space.

### No explicit `null`

***Do not use `null` as a type in any schema.***

This one is tricky to think about, and requires some background.

Historically, Grafana’s dashboard JSON has often contained fields with the explicit value `null`.
This was problematic, because explicit `null` introduces an ambiguity: is a JSON field being present
with value null meaningfully different from the field being absent? That is, should a program behave differently
if it encounters a null vs. an absent field?

In almost all cases, the answer is “no.” Thus, the ambiguity: if both explicit null and absence are *accepted*
by a system, it pushes responsibility onto anyone writing code in that system to decide, case-by-case,
whether the two are *intended to be meaningfully different*, and therefore whether behavior should be different.

CUE does have a `null` type, and only accepts data containing `nulls` as valid if the schema explicitly allows a `null`.
That means, by default, using CUE for schemas removes the possibility of ambiguity in code that receives data validated
by those schemas, even if the language they’re writing in still allows for ambiguity. (Javascript does, Go doesn’t.)

As a schema author, this means you’re being unambiguous by default - no `nulls`. That’s good! The only question is
whether it’s worth explicitly allowing a `null` for some particular case:
~~~ Cue
someField: int32 | null
~~~

The *only* time this *may* be a good idea is if your field needs to be able to represent a value
that is not otherwise acceptable within the value space - for example, if `someField` needs to be able to contain
[Infinity](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/POSITIVE_INFINITY).
When such values are serialized to null by default, it can be convenient to accept null in the schema - but even then,
explicit null is unlikely to be the best way to represent such values, because it is so subtle and falsey.

**Above all, DO NOT accept `null` in a schema simply because current behavior sometimes unintentionally produces a `null`.**
Schematization is an opportunity to get rid of this ambiguity. Fix the accidental null-producing behavior, instead.

### Issues

- If a schema has a "kind" field and its set as enum, it generates a Kind alias that conflicts with the generated
  Kind struct.
- Byte fields are existing in Go but not in TS, so the generator fails.
- **omitempty** is useful when we return things like json.RawMessage (alias of []byte) because Postgres saves this
  information as `nil`, when MySQL and SQLite save it as `{}`. If we found it in the rest of the cases, it isn't necessary
  to set `?` in the field in the schema.


## Schema Attributes

Grafana’s schema system relies on [CUE attributes](https://cuelang.org/docs/references/spec/#attributes)declared on 
properties within schemas to control some aspects of code generation behavior. 
In a schema, an attribute is the whole of `@cuetsy(kind=”type”)`:

~~~ Cue
field: string @cuetsy(kind="type")
~~~

CUE attributes are purely informational - they cannot influence CUE evaluation behavior, including the types being 
expressed in a Thema schema.

CUE attributes have three parts. In `@cuetsy(kind=”type”)`, those are:
- name - `@cuetsy`
- arg - `kind`
- argval - `“type”`

Any given attribute may consist of `{name}`, `{name,arg}`, or `{name,arg,argval}`. These three levels form a tree 
(meaning of any argval is specific to its arg, which is specific to its name). The following documentation represents 
this tree using a header hierarchy.

### @cuetsy

These attributes control the behavior of the [cuetsy code generator](https://github.com/grafana/cuetsy), which converts 
CUE to TypeScript. We include only the kind arg here for brevity; cuetsy’s README has the canonical documentation on all
supported args and argvals, and their intended usage.

Notes:
- Only top-level fields in a Thema schema are scanned for `@cuetsy` attributes.
- Grafana’s code generators hardcode that an interface (`@cuetsy(kind=”interface”)`) is generated to represent the root 
schema object, unless it is known to be a [grouped lineage](https://docs.google.com/document/d/13Rv395_T8WTLBgdL-2rbXKu0fx_TW-Q9yz9x6oBjm6g/edit#heading=h.vx7stzpxtw4t).

#### kind

Indicates the kind of TypeScript symbol that should be generated for that schema field.

#### interface

Generate the schema field as a TS interface. Field must be struct-kinded.

#### enum

Generate the schema field as a TS enum. Field must be either int-kinded (numeric enums) or string-kinded (string enums).

#### type

Generate the schema field as a TS type alias.

### @grafana

These attributes control code generation behaviors that are specific to Grafana core. Some may also be supported
in plugin code generators.

#### TSVeneer

Applying a TSVeneer arg to a field in a schema indicates that the schema author wants to enrich the generated type
(for example by adding generic type parameters), so code generation should expect a handwritten 
[veneer](https://docs.google.com/document/d/13Rv395_T8WTLBgdL-2rbXKu0fx_TW-Q9yz9x6oBjm6g/edit#heading=h.bmtjq0bb1yxp).

TSVeneer requires at least one argval, each of which impacts TypeScript code generation in its own way. 
Multiple argvals may be given, separated by `|`.

A TSVeneer arg has no effect if it is applied to a field that is not exported as a standalone TypeScript type 
(which usually means a CUE field that also has an `@cuetsy(kind=)` attribute).

#### type

A handwritten veneer is needed to refine the raw generated TypeScript type, for example by adding generics. 
See [the dashboard types veneer](https://github.com/grafana/grafana/blob/5f93e67419e9587363d1fc1e6f1f4a8044eb54d0/packages/grafana-schema/src/veneer/dashboard.types.ts) 
for an example, and [some](https://github.com/grafana/grafana/blob/5f93e67419e9587363d1fc1e6f1f4a8044eb54d0/kinds/dashboard/dashboard_kind.cue#L12) 
[corresponding](https://github.com/grafana/grafana/blob/5f93e67419e9587363d1fc1e6f1f4a8044eb54d0/kinds/dashboard/dashboard_kind.cue#L143) 
CUE attributes.

### @grafanamaturity

These attributes are used to support iterative development of a schema towards maturity.

Grafana code generators and CI enforce that schemas marked as mature MUST NOT have any `@grafanamaturity` attributes.

#### NeedsExpertReview

Indicates that a non-expert on that schema wrote the field, and was not fully confident in its type and/or docs.

Primarily useful on very large schemas, like the dashboard schema, for getting *something* written down for a given 
field that at least makes validation tests pass, but making clear that the field isn’t necessarily properly correct.

No argval is accepted. (Use a `//` comment to say more about the attention that’s needed.)
