---
title: Kind Glossary
---

# Kind Glossary

A glossary of terms related to the Grafana schematization effort. This includes the Kind system, Codejen and other tools created to support the schematization of Grafana Objects.

## Schema
A machine-readable specification describing the shape and properties of data.

## Schema System

A set of tools, rules, syntax, etc. that allow authors to express a schema. All useful schema systems can, at minimum, be used to determine whether some particular data is a valid instance of a schema expressed in that system.

Examples: JSON Schema, Apache Avro, Thema

## Thema

A schema system in which versioning and evolution of schemas are a first-class concern. We use Thema as the tool to implement schemas for Grafana objects, in order to take care natively of concerns like versioning and translatability of these schemas while they are evolving to a higher maturity level.See more in [the Thema docs](https://github.com/grafana/thema/blob/main/docs/overview.md).

## Lineage

The concept of Lineage is strictly linked to the other logical components of Thema (see [the Thema components docs](https://github.com/grafana/thema/blob/main/docs/overview.md#about-thema-components)).
Strictly speaking, a lineage is the full sequence of the different versions for a defined schema, and includes the concept of lenses, that represents the mapping between different schema version, to ensure backward compatibility out of the box.

### Grouped Lineage

A Thema lineage where the top-level fields are each independent schemas. It is generally not expected that instances of the whole schema exist in the wild.

Example: Panel [schema interfaces](#schema-interface) must implement both [PanelOptions](https://github.com/grafana/grafana/blob/0d8ea2bb34d6f4ae78d0752e5c1cbaf51b7d10db/public/app/plugins/panel/barchart/models.cue#L29-L56) and [PanelFieldConfig](https://github.com/grafana/grafana/blob/0d8ea2bb34d6f4ae78d0752e5c1cbaf51b7d10db/public/app/plugins/panel/barchart/models.cue#L57-L67) as top-level fields, but Grafana never produces any JSON containing keys with either of those names. Rather, dashboard schema composition logic maps these fields to known positions within the panel schema (`#Panel.options` and `#Panel.fieldConfig.defaults.custom`, respectively)

[It is planned to natively formalize this concept in Thema](https://github.com/grafana/thema/issues/62).


## Kind

A Kind is the specification of a type of object that Grafana knows how to work with - accept via its API, persist, and drive some behavior within the Grafana frontend, backend, or a Grafana plugin. Each [kind definition](#kind-definition) contains a schema, and some [declarative properties and constraints](#kind-metadata).

An instance of a kind is called a resource. Resources are a sequence of bytes - for example, a JSON file or HTTP request body - that conforms to the schemas and other constraints defined in a Kind.

Once Grafana has determined a given byte sequence to be an instance of a known Kind, kind-specific behaviors can be applied, requests can be routed, events can be triggered, etc.

Grafana's kinds are similar to Kubernetes [CustomResourceDefinitions](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#create-a-customresourcedefinition). Grafana provides a standard mechanism for representing its kinds as CRDs.

There are three [categories of kinds](#kind-category): Core, Custom, and Composable.

### Kind Definition

The actual text that declares a kind (.cue file(s)), or some logical representation of that text in a program. 

Example: [this directory](https://github.com/grafana/grafana/tree/main/kinds/dashboard) is the dashboard kind declaration.

### Kind Category

Every kind is a member of exactly one of Grafana’s kind categories - Core, Custom, or Composable. Kind categories generally vary in terms of who declares them (core, plugins) and whether they are intended to define the root of an object (core, custom) or sub-elements that may appear in other objects (composable).

### Kind System

The kind system, often abbreviated “kindsys,” is the collection of specifications and supporting utility functions and tools that form the basis of all Grafana kinds. They are defined in a combination of Go and CUE (see [project repository](https://github.com/grafana/grafana/tree/main/pkg/kindsys)).

### Kind Properties

The parts of a [Kind Declaration](#kind-definition) that are *not* schema declarations. 

Example: [a kind’s name and maturity level](https://github.com/grafana/grafana/blob/0c560b8b0d9d316656e73b631e235253707e6eb4/kinds/structured/playlist/playlist_kind.cue#L3-L5) are properties; but [this part is schema](https://github.com/grafana/grafana/blob/0c560b8b0d9d316656e73b631e235253707e6eb4/kinds/structured/playlist/playlist_kind.cue#L6-L47)


## Core Kind

Core is a [category of kind](#kind-category) for Grafana core-defined arbitrary types. Familiar types and functional resources in Grafana, such as dashboards and datasources, are represented as core kinds.

The canonical specification of Core kinds is [here](https://github.com/grafana/grafana/blob/81af67a0695152ced5635c3d69d250c55d6cc3d4/pkg/kindsys/kindcats.cue#L89). A simple example is [the playlist kind](https://github.com/grafana/grafana/blob/8f294505940ef947caa85ea41083a9b6a97727db/kinds/playlist/playlist_kind.cue#L1-L0), a more complex example is [the dashboard kind](https://github.com/grafana/grafana/blob/8f294505940ef947caa85ea41083a9b6a97727db/kinds/dashboard/dashboard_kind.cue#L1).

## Custom Kind

Custom is a [category of kind](#kind-category) for plugin-defined arbitrary types. Custom kinds have the same purpose as [Core kinds](#core-kind), differing only in that they are declared by external plugins rather than in Grafana core. As such, this specification is kept closely aligned with the Core kind.

Grafana provides Kubernetes apiserver-shaped HTTP APIs for interacting with custom kinds - the same API patterns (and clients) used to interact with k8s CustomResources.

The canonical specification of Custom kinds is [here](https://github.com/grafana/grafana/blob/4db3b2fd5cc0a421b23a4cbae922456bfbf39057/pkg/kindsys/kindcat_custom.cue).

## Composable Kind

Composable is a [category of kind](#kind-category) that provides schema elements for composition into [Core](#core-kind) and [Custom](#custom-kind) kinds. Grafana plugins provide composable kinds, for example, a datasource plugin provides one to describe the structure of its queries, which is then composed into dashboards and alerting rules.

Each Composable kind is an implementation of exactly one [schema interface](#schema-interface).

The canonical specification of Composable kinds is [here](https://github.com/grafana/grafana/blob/a277d504a2b258d01be3a1aa401a19a33b8c817d/pkg/kindsys/kindcat_composable.cue). A simple example is [the news plugin’s PanelCfg](https://github.com/grafana/grafana/blob/d35edb3430a48e1359f8c9ccce00ee0c5029e117/public/app/plugins/panel/news/composable.cue#L17), more complex is [barchart’s PanelCfg](https://github.com/grafana/grafana/blob/d35edb3430a48e1359f8c9ccce00ee0c5029e117/public/app/plugins/panel/barchart/composable.cue#L21).

## Entity

A valid instance of a [kind](#kind).

For example, the contents of a `dashboard.json` file JSON created by exporting a dashboard from the Grafana web UI could be called “a dashboard entity.”

Conventionally usually used to refer to the serialized form (e.g. JSON) an object takes, whether at rest (e.g. in an infra-as-code git repository) or in flight (e.g. the response from the Grafana backend when the Grafana frontend loads a dashboard object).

### Entity Metadata

Metadata about an entity that is not part of the main body of an object.

Entity metadata may not be written by a normal Grafana API client (including Grafana’s frontend), but may be read. Only backend processes may populate entity metadata.

Some entity metadata is specified by the kind system. Other metadata is kind-specific.

Examples of entity metadata include:
- Fields like Created or Updated that track the lifecycle of an object
- Fields that are computed from other fields in the entity, such as [TeamDTO.MemberCount](https://github.com/grafana/grafana/blob/ae8acf178bad20f7e59694edcd9e6a7a0a92ae9a/pkg/models/team.go#L92)


## Schema Interface

Schema interfaces are meta-schemas that govern how composable kinds must be shaped. They are shared contracts between the implementers (composable kinds, defined in Grafana plugins) and consumers (core and custom Grafana kinds) of composable schemas.

Each composable kind is named for and follows the specification of exactly one schema interface.

Only Grafana core may define schema interfaces. There is a finite set of schema interfaces, all defined [here](https://github.com/grafana/grafana/blob/main/pkg/kindsys/schema_interface.cue). The `PanelCfg` schema interface, for example, specifies that if a plugin provides a composable kind implementing the `PanelCfg` schema interface, all schemas in that composable kind must adhere to the following basic schema:

~~~ Cue 
// Defines plugin-specific options for a panel that should be persisted. 
// Required, though a panel without any options may specify an empty struct.
//
// Currently mapped to #Panel.options within the dashboard schema.
PanelOptions: {}


// Plugin-specific custom field properties. Optional.
//
// Currently mapped to #Panel.fieldConfig.defaults.custom in dashboard schema.
PanelFieldConfig?: {}
~~~

## Syntactic Versioning

The version numbering system used by Thema, applied to all schemas defined in Thema. Contrast to [semantic versioning](https://semver.org/).

A syntactic version contains only two numbers, major and minor. A new schema with a new syntactic version always corresponds to some change in the schema. The major version number changes if the change was not backwards compatible.

## Common Schemas

Persisted Grafana objects often contain common elements. This occurs whenever some part of Grafana’s core frameworks offer a capability to a kind (core, custom, or composable), and there are persisted options associated with that core framework capability.

For example, if a panel visualization wants to include a legend, it will likely depend on Grafana’s libraries for producing a legend, and as a result need to persist JSON corresponding to [VizLegendOptions](https://github.com/grafana/grafana/blob/3006a457f2ca62369149fb24de02c757bb6bec9a/packages/grafana-schema/src/common/common.gen.ts#L501).

To be able to use these common elements in other CUE/Thema schemas, the types must be defined in CUE in some shared location - `packages/grafana-schema/src/common`.

Note that before Grafana 10, common types will be required to follow backwards compatibility and forwards compatibility rules for all changes, without exception. Rapidly evolving types should reach stability before moving into the commons.

## Raw Types

The most basic form of code generated from schema for a particular target language.

Sometimes, raw types are adequate for general programming purposes. Other times, supplements are needed, referred to as the [veneer](#veneer).

## Veneer

Veneers are a layer of handwritten types or logic that sit on top of generated code. They improve the ergonomics of generated code in a target language, without interfering with underlying schema semantics.

For example, a veneer may be used to add TypeScript generics to raw generated typescript types, as is done [here](https://github.com/grafana/grafana/blob/3b3059c9ce94515baef5c352d07651a404102bfc/packages/grafana-schema/src/veneer/dashboard.types.ts#L6) for various types defined in the dashboard kind schema.
