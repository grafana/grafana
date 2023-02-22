# Kind System

This package contains Grafana's kind system, which defines the rules that govern all Grafana kind definitions, including both core and plugin kinds. It contains many contracts on which public promises of backwards compatibility are made. All changes must be considered with care.

While this package is maintained by @grafana/grafana-as-code, contributions from others are a main goal! Any time you have the thought, "I wish this part of Grafana's codebase was consistent," rather than writing docs (that people will inevitably miss), it's worth seeing if you can express that consistency as a kindsys extension instead.

This document is the guide to extending kindsys. But first, we have to identify kindsys's key components.

## Elements of kindsys

* **CUE framework** - the collection of .cue files in this directory, `pkg/kindsys`. These are schemas that define how Kinds are defined.
* **Go framework** - the Go package in this directory containing utilities for loading individual kind definitions, validating them against the CUE framework, and representing them consistently in Go.
* **Code generators** - written using the `github.com/grafana/codejen` framework, which applies the [single responsibility principle](https://en.wikipedia.org/wiki/Single-responsibility_principle) to code generation, allowing us to compose modular code generators. Each jenny - a modular generator with a single responsibility - is written as a `pkg/codegen/jenny_*.go` file.
* **Registries** - generated lists of all or a well-defined subset of kinds that can be used in code. `pkg/registries/corekind` is a registry of all core `pkg/kindsys.Interface` implementations; `packages/grafana-schema/src/index.gen.ts` is a registry of all the TypeScript types generated from the current versions of each kind's schema.
* **Kind definitions** - the definitions of individual kinds. By kind category:
  * **Core** - each child directory of `kinds`.
  * **Composable** - In Grafana core, `public/app/plugins/*/*/models.cue` files.
  * **Custom** - No examples in Grafana core. See [operator-app-sdk](https://github.com/grafana/operator-app-sdk) (TODO that repo is private; make it public, or point to public examples).

The above are treated as similarly to stateless libraries - a layer beneath the main Grafana frontend and backend without dependencies on it (no storage, no API, no wire, etc.). This lack of dependencies, and their Apache v2 licensing, allow their use as libraries for external tools.

## Extending kindsys

Extending the kind system generally involves:

* Introducing one or more new fields into the CUE framework
* Updating the Go framework to accommodate the new fields
* Updating the kind authoring and maturity planning docs to reflect the new extension
* (possibly) Writing one or more new code generators
* (possibly) Writing/refactoring some frontend code that depends on new codegen output
* (possibly) Writing/refactoring some backend code that depends on codegen output and/or the Go kind framework
* (possibly) Tweaking all existing kinds as-needed to accommodate the new extension

_TODO detailed guide to the above steps_

The above steps certainly aren't trivial. But they all come only after figuring out a way to solve the problem you want to solve in terms of the kind system and code generation in the first place.

_TODO brief guide on how to think in codegen_

## Extensions not involving kind metadata

While the main path for extending kindsys is through adding metadata, there are some other ways of extending kindsys.

### CUE attributes

[CUE attributes](https://cuelang.org/docs/references/spec/#attributes) provide additional information to kind tooling. They are suitable when it is necessary for a schema author to express additional information about a particular field or definition within a schema, without actually modifying the meaning of the schema. Two such known patterns are:

* Controlling nuanced behavior of code generators for some field or type. Example: [@cuetsy](https://github.com/grafana/cuetsy#usage) attributes, which govern TS output
* Expressing some kind of structured TODO or WIP information on a field or type that can be easily analyzed and fed into other systems. Example: a kind marked at least `stable` maturity may not have any `@grafanamaturity` attributes

In both of these cases, attributes are a tool _for the individual kind author_ to convey something to downstream consumers of kind definitions. It is essential. While attributes allow consistency in _how_ a particular task is accomplished, they leave _when_ to apply the rule up to the judgment of the kind author.

Attributes occupy an awkward middle ground. They are more challenging to implement than standard kind framework properties, and less consistent than general codegen transformers while still imposing a cognitive burden on kind authors. They should be the last tool you reach for - but may be the only tool available when field-level schema metadata is required.

TODO create a general pattern for self-contained attribute parser/validators to follow

### Codegen transformers

TODO actually write this - use `Uid`->`UID` as example
