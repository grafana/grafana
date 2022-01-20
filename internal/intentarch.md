# Intent API planned architecture

Grafana's experimental Intent API is an enormous project. To help keep discussion and collaboration broadly aligned, this document contains a rough, handwavy system diagram indicating completed and planned dependencies between major parts.

TODO diagram

## Definitions

### Component

A Component is a subtree of Grafana backend code that is:

- Rooted by a blank file named `componentroot` (similar to how `.git` and `go.mod` indicate the root of a tree)
- Owned by at least one team (as indicated by OWNERS, which must exist)
- Has at least one group, as determined by component group conditions
- Is restricted in what packages it may import and what Go types it may reference, via the rules corresponding to its group(s)

The primary purpose of this "Component" construct is to create the thinnest possible mapping between code ownership, filesystem structure and certain logical roles the code plays in Grafana's backend overall. It is intended to compose cleanly with other abstractions, like Go's `internal` directory, Wire/different build modes, and the need to afford developers flexibility in package organization as a prerequisite to keeping codebases tidy.

Components may not be nested.

Examples of components:

- Existing
  - `github.com/grafana/grafana/pkg/services/cleanup`
  - `github.com/grafana/grafana/pkg/services/ngalert` (will be in _service_ group)
  - ...many more
- Planned
  - `github.com/grafana/grafana/internal/serviceng/datasource` (group: _coreschema_)
  - User (group: _coreschema_)
  - ...many more

### Component Group

A Component Group is a named set of two properties:

- **Conditions**: the set of Component Group Conditions that trigger membership in a group when met by a particular Component. If any one condition is met, then all conditions must be met.
- **Import denylist**: a set of Go packages or type identifiers that MAY NOT be imported/referenced, directly or transitively, by any non-test package in the Component

Examples of service groups:

- **`coreschema`**
  - This group contains all the components that are sources of core schemas - those that are known at compile time.
  - **Conditions**:
    - References `github.com/grafana/grafana/pkg/schema.CoreRegistry`
  - **Import denylist**:
    - imports `github.com/grafana/grafana/internal/service/client`
- **`service`**
  - This group contains all the service-ish subsystems that Grafana can either run locally (gRPC-based communication with local subprocess, a la Hashicorp's Go plugins) or remotely (gRPC-based communication with an independently-compiled instance of the component subtree, run independently of and connected to by Grafana instances).
  - **Conditions**: _(These should be imports/types that we expect any component that has to run remotely)_
    - imports `github.com/grafana/grafana-plugin-sdk-go/backend` (plausible, though it might be nice to move into main grafana repo?)
    - imports `github.com/grafana/grafana/internal/service/client` (handwavy: contains abstractions over gh/g/g/pkg/plugins/backendplugin/{coreplugin,grpcplugin}, or some more general version that's usable outside plugins)
  - **Import denylist**:
    - imports `github.com/grafana/grafana/pkg/services/sqlstore` (you can't rely on sqlstore AND be runnable as an independent binary)

Note how the joint effect of the conditions and denylists on `coreschema` and `service` results in the two component groups being mutually exclusive. That's the goal! Anything that can be run remotely necessarily can't produce schema that are knowable at Grafana backend compile time. Attaching those properties to actual types, rather some metadata system, means that the rules work even if developers forget or can't figure out the metadata.
