# Currently recommended practices

We occasionally identify patterns that are either useful or harmful that
we'll want to introduce or remove from the codebase. When the complexity
or importance of introducing or removing such a pattern is sufficiently
high, we'll document it here to provide an addressable local
'currently recommended practice'. By collecting these practices in a
single place, we're able to reference them and make it easier to have a
shared understanding of how to write idiomatic code for the Grafana
backend.

Large-scale refactoring based on a new recommended practice is a
delicate matter, and most of the time it's better to introduce the new
way incrementally over multiple releases and over time to balance the
want to introduce new useful patterns and the need to keep Grafana
stable. It's also easier to review and revert smaller chunks of changes,
reducing the risk of complications.

| State            | Description                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposed         | The practice has been proposed and been positively received by the Grafana team. Following the proposal is a discretionary choice for developers. |
| Ongoing, active  | The practice is actively being worked on. New code should adhere to the practice where at all possible.                                           |
| Ongoing, passive | There is no immediate active work on refactoring old code. New code should adhere to the practice where at all possible.                          |
| Completed        | The work has been done and there is no, or negligible, legacy code left that need refactoring. New code must adhere to the practice.              |
| Abandoned        | The practice has no longer any active ongoing work and new code don't need to comply with the practice described.                                 |

## 1 - Idiomatic Grafana code should be idiomatic Go code

**Status:** Ongoing, passive.

It'll be easier for contributors to start contributing to Grafana if our
code is easily understandable. When there isn't a more specific Grafana
recommended practice, we recommend following the practices as put forth
by the Go project for development of Go code or the Go compiler itself
when applicable.

The first resource we recommend everyone developing Grafana's backend to
skim is "[Effective Go](https://golang.org/doc/effective_go.html)",
which isn't updated to reflect more recent changes since Go was
initially released but remain a good source for understanding the
general differences between Go and other languages.

Secondly, the guidelines for [Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
for the Go compiler can mostly be applied directly to the Grafana
codebase. There are idiosyncrasies in Grafana such as interfaces living
closer to its declaration than to its users for services and don't
enforce documentation of public declarations (prioritize high coverage
of documentation aimed at end-users over documenting internals in the
backend).

- [Effective Go](https://golang.org/doc/effective_go.html)
- [Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)

## 100 - Global state

**State:** Ongoing, passive.

Global state makes testing and debugging software harder, and it's something we want to avoid when possible. Unfortunately, there is quite a lot of global state in Grafana.

We want to migrate away from this by using
[Wire](https://github.com/google/wire) and dependency injection to pack

## 101 - Limit the use of the init() function

**State:** Ongoing, passive.

Only use the init() function to register services/implementations.

## 102 - Settings refactoring

**State:** Ongoing, passive.

The plan is to move all settings to from package level vars in settings package to the [setting.Cfg](https://github.com/grafana/grafana/blob/df917663e6f358a076ed3daa9b199412e95c11f4/pkg/setting/setting.go#L210) struct. To access the settings, services and components can inject this setting.Cfg struct:

- [Cfg struct](https://github.com/grafana/grafana/blob/df917663e6f358a076ed3daa9b199412e95c11f4/pkg/setting/setting.go#L210)
- [Injection example](https://github.com/grafana/grafana/blob/c9773e55b234b7637ea97b671161cd856a1d3d69/pkg/services/cleanup/cleanup.go#L34)

## 103 - Reduce the use of GoConvey

**State:** Completed.

We want to migrate away from using GoConvey. Instead, we want to use
stdlib testing with [testify](https://github.com/stretchr/testify),
because it's the most common approach in the Go community, and we think
it will be easier for new contributors. Read more about how we want to
write tests in the [style guide](/contribute/backend/style-guide.md).

## 104 - Refactor SqlStore

**State:** Completed.

The `sqlstore` handlers all use a global xorm engine variable. Refactor them to use the `SqlStore` instance.

## 105 - Avoid global HTTP handler functions

**State:** Ongoing, passive.

Refactor HTTP handlers so that the handler methods are on the HttpServer instance or a more detailed handler struct. E.g (AuthHandler). This ensures they get access to HttpServer service dependencies (and Cfg object) and can avoid global state.

## 106 - Date comparison

**State:** Ongoing, passive.

Store newly introduced date columns in the database as epoch based
integers (i.e. unix timestamps) if they require date comparison. This
permits a unified approach for comparing dates against all the supported
databases instead of handling dates differently for each database. Also,
by comparing epoch based integers, we no longer need error pruning
transformations to and from other time zones.

## 107 - Avoid use of the simplejson package

**State:** Ongoing, passive

Use of the `simplejson` package (`pkg/components/simplejson`) in place
of types (Go structs) results in code that is difficult to maintain.
Instead, create types for objects and use the Go standard library's
[`encoding/json`](https://golang.org/pkg/encoding/json/) package.

## 108 - Provisionable\*

**State:** Abandoned: Grafana's file based refactoring is limited to work natively only on on-premise installations of Grafana. We're looking at enhancing the use of the API to enable provisioning for all Grafana instances.

All new features that require state should be possible to configure using config files. For example:

- [Data sources](https://github.com/grafana/grafana/tree/main/pkg/services/provisioning/datasources)
- [Alert notifiers](https://github.com/grafana/grafana/tree/main/pkg/services/provisioning/notifiers)
- [Dashboards](https://github.com/grafana/grafana/tree/main/pkg/services/provisioning/dashboards)

Today it's only possible to provision data sources and dashboards but this is something we want to support all over Grafana.

### 109 - Use context.Context "everywhere"

**State:** Completed.

The package [context](https://golang.org/pkg/context/) should be used
and propagated through all the layers of the code. For example the
`context.Context` of an incoming API request should be propagated to any
other layers being used such as the bus, service and database layers.
Utility functions/methods normally doesn't need `context.Context`.
To follow Go best practices, any function/method that receives a
[`context.Context` argument should receive it as its first parameter](https://github.com/golang/go/wiki/CodeReviewComments#contexts).

To be able to solve certain problems and/or implement and support
certain features making sure that `context.Context` is passed down
through all layers of the code is vital. Being able to provide
contextual information for the full life-cycle of an API request allows
us to use contextual logging, provide contextual information about the
authenticated user, create multiple spans for a distributed trace of
service calls and database queries etc.

Code should use `context.TODO` when it's unclear which Context to use,
or it is not yet available (because the surrounding function has not yet
been extended to accept a `context.Context` argument).

More details in [Services](/contribute/backend/services.md), [Communication](/contribute/backend/communication.md) and [Database](/contribute/backend/database.md).

[Original design doc](https://docs.google.com/document/d/1ebUhUVXU8FlShezsN-C64T0dOoo-DaC9_r-c8gB2XEU/edit#).

## 110 - Move API error handling to service layer

**State:** Ongoing, passive.

All errors returned from Grafana's services should carry a status and
the information necessary to provide a structured end-user facing
message that the frontend can display and internationalize for
end-users.

More details in [Errors](/contribute/backend/errors.md).
