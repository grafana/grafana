# Backend code structure

Grafanas backend is written in GO using sqlite3/mysql or postgres as storage for dashboards, users etc. When Grafana was born there didnt exist much guides or direction for how to write medium sized application. So there are parts of Grafana code base that didn't quite pan out as we wanted. More about that under current rewrites! :)

## Central folders of Grafanas backend

| folder | description |
| ------- | ----------- |
| /pkg/api | Http Handlers and routing. Almost all handler funcs are global which is something we would like to improve in the future. Handlers should be assosicated with a struct that refers to all depedencies. Ex bus. |
| /pkg/cmd | The binaries that we build. Grafana-server and grafana-cli. |
| /pkg/components | Mixed content of packages that we copied into Grafana and packages we implemented ourself. The Purpose of this folders should be packages that are too big for util and doesnt belong somewhere else. |
| /pkg/infra | Packages in infra should be packages that are used in multiple places of Grafana without knowing anything about Grafana domain. E.g. Logs, Metrics, Traces. |
| /pkg/services | Packages in services are responsible for peristing domain objects and manage the relationship between domain objects. Services should communicate with each other using DI when possible. Most part of Grafana's codebase still relay on Global state for this. Any new features going forwards should use DI. |
| /pkg/tsdb | All backend implementations of the datasources in Grafana. Used by both Grafanas frontend and alerting. |
| /pkg/util | Small helper functions that are used in multiple parts of the codebase. Many functions are placed directly in the util folders which is something we want to avoid. Its better to give the util function a more descriptive package name. Ex `errutil`. |

## Central components of Grafanas backend

| package | description |
| ------- | ----------- |
| /pkg/bus | The bus! Described more below. |
| /pkg/models | This is where we keep our domain model. This package should not depend on any package outside standard library. (It does contain some refs within Grafana but that is something we should avoid going forward). |
| /pkg/registry | service management package. |
| /pkg/services/alerting | Grafanas alerting services. The alerting engine run in a seperate go routine and should not depend on anything else within Grafana. |
| /pkg/services/sqlstore | Currently where are database calls resides. |
| /pkg/setting | settings package for Grafana. Anything related to grafana global configuration should be dealt with in this package. |

## Testing
We value clean & readable code that is loosely coupled and covered by unit tests. This makes it easier to collaborate and maintain the code. In the sqlstore package we do database operations in tests and while some might say that's not suited for unit tests. We think they are fast enough and provide a lot of value.

The majority of our tests uses go convey but thats something we want to avoid going forward.
For new tests we want to use standard library and `testify/assert`.

## The Bus
The bus is our way to introduce indirection between the HTTP handlers and sqlstore (responsible for fetching data from the database). Http handlers and sqlstore don't depend on each other. They only depend on the bus and the domain model(pkg/models). This makes it easier to test the code and avoids coupling. More about this under `current rewrite/refactorings`

## Services/Repositories
Services within Grafana should be self-contained and only talk to other parts of Grafana using the bus or repositories that have been made available through Grafana service registry. All services should register themselves to the `registry` package in an init function. Only registration should be done in the init function. Init functions should be avoided as much as possible.

When Grafana starts all init functions within the services will be called and register themselves.
Grafana will then create a Graph of all dependencies and inject the services that other services depend on. This is solved with [inject library](https://github.com/facebookgo/inject) in https://github.com/grafana/grafana/blob/master/pkg/cmd/grafana-server/server.go#L75

## Provisionable*
All new features that require state should be possible to configure using config files. Ex [datasources](https://github.com/grafana/grafana/tree/master/pkg/services/provisioning/datasources), [alert notifiers](https://github.com/grafana/grafana/tree/master/pkg/services/provisioning/notifiers), [dashboards](https://github.com/grafana/grafana/tree/master/pkg/services/provisioning/dashboards), teams etc. Today its only possible to provision datasources and dashboards but this is something we want to support all over Grafana.
