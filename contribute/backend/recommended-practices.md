# Currently recommended practices

Grafana Labs occasionally identifies patterns that may be useful or harmful so that we can introduce or remove from the codebase.
When the complexity or importance of introducing or removing such idiomatic patterns is sufficiently high, we document it on this page to provide a reference. Because the relevance of these practices may vary over time, we call them _currently recommended practices_.

## Large-scale refactoring

Large-scale refactoring based on a new recommended practice is a
delicate matter. It's usually better to introduce the new
way incrementally over multiple releases and over time to balance the
desire to introduce new useful patterns with the need to keep Grafana
stable. It's also easier to review and revert smaller chunks of changes,
reducing the risk of complications.

## States of refactoring

Refer to the following table to identify important categories of refactoring.

| State            | Description                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Proposed         | This is an optional practice that has been proposed and received positively by the Grafana team. Follow this proposal as you choose.  |
| Ongoing, active  | The practice is actively being worked on. New code should adhere to the practice whenever possible.                                   |
| Ongoing, passive | There's no immediate active work on refactoring old code. New code should adhere to the practice whenever possible.                   |
| Completed        | The work has been done and there is no, or negligible, legacy code left that needs refactoring. New code must adhere to the practice. |
| Abandoned        | The practice doesn't have any active ongoing work and new code doesn't need to comply with the practice described.                    |

## 1 - Idiomatic Grafana code should be idiomatic Go code

**Status:** Ongoing, passive.

It's easier for contributors to start contributing to Grafana if our
code is easily understandable. When there isn't a more specific Grafana
recommended practice, we recommend that you follow the practices as put forth
by the Go project for development of Go code or the Go compiler itself
as appropriate.

Firstly, best practice is the online book [_Effective Go_](https://golang.org/doc/effective_go.html), which isn't updated to reflect more recent changes since Go was initially released, but which remains a good source for understanding the general differences between Go and other languages.

Secondly, the guidelines for [Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments) for the Go compiler can mostly be applied directly to the Grafana codebase.
There are idiosyncrasies in Grafana, such as interfaces living closer to their declarations than to their users for services, and the documentation doesn't enforce public declarations.
Instead, the documentation prioritizes high coverage aimed at end-users over documenting internals in the backend.

- [_Effective Go_](https://golang.org/doc/effective_go.html).
- [Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments).

## 100 - Global state

**State:** Ongoing, passive.

Global state makes testing and debugging software harder, and it's something we want to avoid whenever possible.

Unfortunately, there's quite a lot of global state in Grafana.
We want to migrate away from this state by using
[Wire](https://github.com/google/wire) and dependency injection to pack code.

## 101 - Limit use of the init() function

**State:** Ongoing, passive.

Don't use the `init()` function for any purpose other than registering services or implementations.

## 102 - Refactor settings

**State:** Ongoing, passive.

We plan to move all settings from package-level vars in the settings package to the [`setting.Cfg`](https://github.com/grafana/grafana/blob/df917663e6f358a076ed3daa9b199412e95c11f4/pkg/setting/setting.go#L210) struct. To access the settings, services and components can inject `setting.Cfg`:

- [`Cfg` struct](https://github.com/grafana/grafana/blob/df917663e6f358a076ed3daa9b199412e95c11f4/pkg/setting/setting.go#L210)
- [Injection](https://github.com/grafana/grafana/blob/c9773e55b234b7637ea97b671161cd856a1d3d69/pkg/services/cleanup/cleanup.go#L34)

## 103 - Reduce use of GoConvey

**State:** Completed.

We encourage you to migrate away from using GoConvey.
Instead, we suggest the use of `stdlib` testing with [testify](https://github.com/stretchr/testify), because it's the most common approach in the Go community, and we think it will be easier for new contributors.
To learn more about how we want to write tests, refer to the [backend style guide](/contribute/backend/style-guide.md).

## 104 - Refactor SqlStore

**State:** Completed.

The `sqlstore` handlers all use a global `xorm` engine variable. Refactor them to use the `SqlStore` instance.

## 105 - Avoid global HTTP handler functions

**State:** Ongoing, passive.

Refactor HTTP handlers so that the handler methods are on the `HttpServer` instance or a more detailed handler struct. For example, `AuthHandler`.
Doing so ensures that the handler methods get access to `HttpServer` service dependencies (and its `Cfg` object), so that global state may be avoided.

## 106 - Compare dates

**State:** Ongoing, passive.

Store newly introduced date columns in the database as epoch-based integers (that is, Unix timestamps) if they require date comparison.
This permits you to have a unified approach for comparing dates against all the supported databases instead of needing to handle dates differently for each database.
Also, when you compare epoch-based integers you no longer need error-pruning transformations to and from other time zones.

## 107 - Avoid the `simplejson` package

**State:** Ongoing, passive

Don't use the `simplejson` package (`pkg/components/simplejson`) instead of types (that is, Go structs) because this results in code that is difficult to maintain.
Instead, create types for objects and use the Go standard library's
[`encoding/json`](https://golang.org/pkg/encoding/json/) package.

## 108 - Enable provisioning

**State:** Abandoned: The file-based refactoring of Grafana is limited to work natively only on on-premise installations of Grafana.
We want to enhance the use of the API to enable provisioning for all Grafana instances in the future.

All new features that require state should be able to configure Grafana using configuration files.
For example:

- [Data sources](https://github.com/grafana/grafana/tree/main/pkg/services/provisioning/datasources)
- [Alert notifiers](https://github.com/grafana/grafana/tree/main/pkg/services/provisioning/notifiers)
- [Dashboards](https://github.com/grafana/grafana/tree/main/pkg/services/provisioning/dashboards)

Today it's only possible to provision data sources and dashboards, but we want to support it throughout Grafana in the future.

## 109 - Use `context.Context`

**State:** Completed.

You should use and propagate the package [`context`](https://golang.org/pkg/context/) through all the layers of your code.
For example, the `context.Context` of an incoming API request should be propagated to any other layers being used, such as the bus, service layer, and database layer.
Utility functions and methods normally don't need `context.Context`.
To follow Go best practices, any function or method that receives a
`context.Context` argument should receive it as its [first parameter](https://github.com/golang/go/wiki/CodeReviewComments#contexts).

We encourage you to make sure that `context.Context` is passed down through all layers of your code.
When you provide contextual information for the full life cycle of an API request, Grafana can use contextual logging. It also provides contextual information about the
authenticated user, and it creates multiple spans for a distributed trace of service calls, database queries, and so on.

Code should use `context.TODO` whenever it's unclear which `Context` to use,
or if it isn't yet available because the surrounding function hasn't yet
been extended to accept a `context.Context` argument. For more details, refer to the documentation:

- [Services](/contribute/backend/services.md)
- [Communication](/contribute/backend/communication.md)
- [Database](/contribute/backend/database.md)

## 110 - Move API error handling to service layer

**State:** Ongoing, passive.

All errors returned from services in Grafana should carry a status and
the information necessary to provide a structured message that faces the end-user. Structured messages can be displayed on the frontend and may be [internationalized](../internationalization.md).

To learn more, refer to [Errors](/contribute/backend/errors.md).
