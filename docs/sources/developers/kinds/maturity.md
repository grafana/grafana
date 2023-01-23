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

Grafana is moving to a schema-centric model of development, where schemas are the single source of truth that specify 
the shape of objects - for example, dashboards, datasources, users - in the frontend, backend, and plugin code. 
Eventually, all of Grafana’s object types will be schematized within the “Kind System.” Kinds, their schemas, the Kind 
system rules, and associated code generators will collectively provide a clear, consistent foundation for Grafana’s 
APIs, documentation, persistent storage, clients, as-code tooling, and so forth.

It’s exciting to imagine the possibilities that a crisp, consistent development workflow will enable - this is why 
companies build [developer platforms](https://internaldeveloperplatform.org/)! At the same time, it’s also 
overwhelming - any schema system that can meet Grafana’s complex requirements will necessarily have a lot of moving 
parts. Additionally, we must account for having Grafana continue to work as we make the transition - a prerequisite 
for every large-scale refactoring.

**This document is the canonical reference for *how* to write Grafana schemas: start from nothing, and confidently 
iterate to a mature initial version.** (Maintaining and evolving schemas *after* maturity is reached is a topic for 
another doc.)

There are several planned categories of Kinds for Grafana. The schema authoring workflow for each varies, as does the 
path to maturity. This doc contains general reference material applicable to all Kind-writing, and links to the guides 
for each category of Kind. Shortly, we’ll give you the necessary information to figure out which guide to follow. Before
that, though, some context on the overarching goal of “schema maturity” is helpful.

## About schema maturity

If you hacked on any Grafana schema from 2021Q1-2022-Q3, then you’ve probably had the following anxious thought: “What 
promise does merging this PR make to Grafana users and developers?” 😬😱😬

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

## Which category of Grafana kind do I need to write?

In the Grafana ecosystem, there are three basic Kind categories and associated schema categories. The following table 
summarizes each category, and links to additional resources, including the maturity guide for that category.

| Category                                                                                                                                                                                                                                                           | What is it?                                                                                                                                                                                                                                                                                                           | Maturity Milestones                           | Examples                                                                                                                                                                                                                                                                         |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Core Kind (Structured) <br/>[Guide](https://docs.google.com/document/u/0/d/1X_R-R5LIhGoqvZUec7tQyaPXduQW_qivWJjFao5-LJ4/edit) &#124; [Spec](https://github.com/grafana/grafana/blob/34815a8c04a5934cc567cc4302ed4af3355bc5fe/pkg/framework/kind/type.cue#L85-L106) | Kinds that define Grafana’s core schematized object types - dashboards, datasources, users, and such.                                                                                                                                                                                                                 | Merged<br/>Experimental<br/>Stable<br/>Mature | [dashboard](https://github.com/grafana/grafana/pull/56492/files#diff-2e74e4698f8f7f62e1bb57f8d729e635a38ac219c73e1188776a878b4502c151)<br/>[playlist](https://github.com/grafana/grafana/pull/56492/files#diff-e053ed66d2f98cb99f2273903ee09ebd739f05a5d5bed13aa7fd9fc39ee79c84) |
| Custom Kind<br/>Guide &#124; [Spec](https://github.com/grafana/grafana/blob/34815a8c04a5934cc567cc4302ed4af3355bc5fe/pkg/framework/kind/type.cue#L108-L111)                                                                                                        | Schemas defined by Grafana plugins/apps for objects that are essential to the operation of the plugin/app. For example, a Synthetic Monitoring “[check](https://grafana.com/docs/grafana-cloud/synthetic-monitoring/checks/)” should be a custom Kind.Plugins/apps are not currently allowed to define raw Kinds.     | Merged<br/>Experimental<br/>Stable<br/>Mature | None yet                                                                                                                                                                                                                                                                         |
| Composable Kind<br/>Guide &#124; [Spec](https://github.com/grafana/grafana/blob/fb42532a6c49408a5da940586d4b053a5e8e752b/pkg/framework/kind/type.cue#L126-L140)                                                                                                    | Schemas defined in plugins that adhere to a meta-schema specified by a [Grafana slot](https://docs.google.com/document/d/13Rv395_T8WTLBgdL-2rbXKu0fx_TW-Q9yz9x6oBjm6g/edit#heading=h.f3onnwdi0a4d), and are intended for composition into a core or custom kind.These lack any functional maturity process (for now). | Merged<br/>Experimental<br/>Stable<br/>Mature | [barchart](https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/barchart/models.cue)                                                                                                                                                                            |

Consistent with the common industry pattern of wrapping a DSL around schemas, each of these categories is defined in CUE
by the Kind framework. Each definition specifies the way a Kind is declared in a .cue file on disk, and is linked as 
“Spec” in the above table.

The properties govern certain code generation and runtime behavior for the Kind, and controls how all of these behaviors
relate to the path to maturity.

## Maturity process guides

Grafana’s schematized Kinds are all expressed using Thema. Consequently, all the schematization cases have a common 
first step: writing schemas with Thema. It is recommended to complete 
[Thema’s quickstart](https://github.com/grafana/thema/blob/main/docs/go-quickstart.md), which steps through schema 
authoring basics.

All have in common that there is one .cue input file, and one command to run that updates all the targets. Our code 
generators are idempotent - they 
[*never* produce stubs](https://github.com/grafana/grafana/pull/54816#issuecomment-1256341790). Consequently, it is a 
system you can learn a lot about through trial and error: try something, run the generator, then see the effects by 
running `git diff`.

When writing Thema schemas within Grafana, there are a few key differences vs. the approach in the Thema tutorial:
- All schema-based codegen in grafana/grafana is performed by make `gen-cue`, rather than by invoking the thema CLI.
- Grafana code generators support certain attributes the Thema CLI is not natively aware of.
- Thema lineages are expected to be declared at specific subpaths within .cue files, varying by category.

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

## Use precise numeric types

***Use precise numeric types like `float64` or `uint32`. Never use `number`.***

Never use `number` for a numeric type in a schema.

Instead, use a specific, sized type like `int64` or `float32`. This makes your intent precisely clear. 
TypeScript will still represent these fields with `number`, but other languages (e.g. Go, Protobuf) can be more precise.

Unlike in Go, int and uint are not your friends. These correspond to `math/big` types. Use a sized type, 
like `uint32` or `int32`, unless the use case specifically requires a huge numeric space.

## No explicit `null`
 
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

## Setting Defaults and Field Optionality

**TODO oof is this a complicated topic**

## Comments and Documentation

Kind declarations are used to generate a variety of documentation. This is a superpower of schema-centric 
development - certain key documentation can automatically be kept in line with the code. 

But, that documentation can only be as good as the source from which it’s generated. This section offers guidance 
on how to write effective documentation for kinds in the kind declarations themselves.

### Kind-level documentation
TODO providing a high-level summary of the type
TODO link to examples of where it shows up

### Field-level documentation
TODO criteria for writing good field-level docs
TODO link to examples of where it shows up**


## Issues

- If a schema has a "kind" field and its set as enum, it generates a Kind alias that conflicts with the generated 
Kind struct.
- Byte fields are existing in Go but not in TS, so the generator fails.
- **omitempty** is useful when we return things like json.RawMessage (alias of []byte) because Postgres saves this 
information as `nil`, when MySQL and SQLite save it as `{}`. If we found it in the rest of the cases, it isn't necessary
to set `?` in the field in the schema.


# Schema Maturity Milestones

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

### Milestone 3 - Stable {#stable}

| **Goal**                     | Kind schemas are the source of truth for all target domains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Reached when**             | The set of schematized fields and their types is agreed upon by all relevant parties.<br/> - No [@grafanamaturity(MaybeRemove)](#grafanamaturity) attributes exist in the schema <br/> - No [@grafanamaturity(NeedsExpertReview)](#grafanamaturity) attributes exist in the schema <br/>Documentation/comments at both the Kind and field level is comprehensive and accurate. <br/>Optional fields and default values follow best practices <br/>The schema’s owners are ready to start following Thema rules for schema evolution(TODO LINK): published schemas are immutable, lenses map between schema versions. |
| **Common hurdles**           | Deciding what breaking changes are acceptable vs. the old, pre-schemas world                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Public-facing guarantees** | Breaking changes in newer versions are clearly documented and have a resolution path defined and published, that users can followDocumentation includes schema examples for best practices                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Stage comms**              | Beta : we have 2 types of users that we want to target for this phase:- Users that we have already had contact with, regarding as code. This includes all customers that have requested the feature and all customers we have talked to in the past months - Campaign-recruited users: Advertise the functionality (blog post? Intercom?) and explain to customers how to enroll in this Beta phase.  - Customer expectations to be aligned to the [Beta](https://docs.google.com/document/d/1lqp0hALax2PT7jSObsX52EbQmIDFnLFMqIbBrJ4EYCE/edit#heading=h.ppvlnoblvlqd) phase int hte release definition document     |


### Milestone 4 - Mature {#mature}

###
| **Goal**                     | The operational transition path for the Kind is battle-tested and reliable.                                                                                                                                                                                                                                                               |
|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Reached when**             | A transition path from the pre-schematized world has been created and tested.<br/>Any feature flags guarding schema-centric behavior (e.g. generic object storage instead of legacy SQL storage for the Kind) are enabled by default or removed                                                                                           |
| **Common hurdles**           | (We don’t know yet!)                                                                                                                                                                                                                                                                                                                      |
| **Public-facing guarantees** | Backward compatibility for newer versions with previous schema versions (starting from open beta, 1.0 version). General support agreement for our GA features                                                                                                                                                                             |
| **User-facing stage**        | Beta - open: anyone can use schemas, the functionality is marked asd beta.<br/> - Define metrics for Beta to GA transition (adoption? Number of change requests and bug opened trending down? ) Or should we skip open beta? All suggestions welcomeGA: the schema is launched and can be used as part of the Grafana toolkit for as-code |


# Schema Attributes

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

***
## @cuetsy

These attributes control the behavior of the [cuetsy code generator](https://github.com/grafana/cuetsy), which converts 
CUE to TypeScript. We include only the kind arg here for brevity; cuetsy’s README has the canonical documentation on all
supported args and argvals, and their intended usage.

Notes:
- Only top-level fields in a Thema schema are scanned for `@cuetsy` attributes.
- Grafana’s code generators hardcode that an interface (`@cuetsy(kind=”interface”)`) is generated to represent the root 
schema object, unless it is known to be a [grouped lineage](https://docs.google.com/document/d/13Rv395_T8WTLBgdL-2rbXKu0fx_TW-Q9yz9x6oBjm6g/edit#heading=h.vx7stzpxtw4t).

### kind

Indicates the kind of TypeScript symbol that should be generated for that schema field.

### interface

Generate the schema field as a TS interface. Field must be struct-kinded.

### enum

Generate the schema field as a TS enum. Field must be either int-kinded (numeric enums) or string-kinded (string enums).

### type

Generate the schema field as a TS type alias.

***
## @grafana

These attributes control code generation behaviors that are specific to Grafana core. Some may also be supported
in plugin code generators.

### TSVeneer

Applying a TSVeneer arg to a field in a schema indicates that the schema author wants to enrich the generated type
(for example by adding generic type parameters), so code generation should expect a handwritten 
[veneer](https://docs.google.com/document/d/13Rv395_T8WTLBgdL-2rbXKu0fx_TW-Q9yz9x6oBjm6g/edit#heading=h.bmtjq0bb1yxp).

TSVeneer requires at least one argval, each of which impacts TypeScript code generation in its own way. 
Multiple argvals may be given, separated by `|`.

A TSVeneer arg has no effect if it is applied to a field that is not exported as a standalone TypeScript type 
(which usually means a CUE field that also has an `@cuetsy(kind=)` attribute).

### type

A handwritten veneer is needed to refine the raw generated TypeScript type, for example by adding generics. 
See [the dashboard types veneer](https://github.com/grafana/grafana/blob/5f93e67419e9587363d1fc1e6f1f4a8044eb54d0/packages/grafana-schema/src/veneer/dashboard.types.ts) 
for an example, and [some](https://github.com/grafana/grafana/blob/5f93e67419e9587363d1fc1e6f1f4a8044eb54d0/kinds/dashboard/dashboard_kind.cue#L12) 
[corresponding](https://github.com/grafana/grafana/blob/5f93e67419e9587363d1fc1e6f1f4a8044eb54d0/kinds/dashboard/dashboard_kind.cue#L143) 
CUE attributes.

***
## @grafanamaturity

These attributes are used to support iterative development of a schema towards maturity.

Grafana code generators and CI enforce that schemas marked as mature MUST NOT have any `@grafanamaturity` attributes.

### NeedsExpertReview

Indicates that a non-expert on that schema wrote the field, and was not fully confident in its type and/or docs.

Primarily useful on very large schemas, like the dashboard schema, for getting *something* written down for a given 
field that at least makes validation tests pass, but making clear that the field isn’t necessarily properly correct.

No argval is accepted. (Use a `//` comment to say more about the attention that’s needed.)

### MaybeRemove

Field was added as part of applying the maximalist rule, and should be considered for removal in a subsequent review of 
the schema.
