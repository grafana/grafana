# Backend

This directory contains the code for the Grafana backend that is intended to be unavailable as a public API. This document gives an overview of the directory structure, and ongoing refactorings.

For more information on developing for the backend:

- [Backend style guide](/contribute/style-guides/backend.md)
- [Architecture](/contribute/architecture)

## Central folders of Grafana's backend

| folder | description |
| ------- | ----------- |
| /internal/api | HTTP handlers and routing. Almost all handler funcs are global which is something we would like to improve in the future. Handlers should be associated with a struct that refers to all dependencies. |
| /internal/components | A mix of third-party packages and packages we have implemented ourselves. Includes our packages that have out-grown the util package and don't naturally belong somewhere else. |
| /internal/infra | Packages in infra should be packages that are used in multiple places in Grafana without knowing anything about the Grafana domain. |
| /internal/services | Packages in services are responsible for persisting domain objects and manage the relationship between domain objects. Services should communicate with each other using DI when possible. Most of Grafana's codebase still relies on global state for this. Any new features going forward should use DI. |
| /internal/tsdb | All backend implementations of the data sources in Grafana. Used by both Grafana's frontend and alerting. |
| /internal/util | Small helper functions that are used in multiple parts of the codebase. Many functions are placed directly in the util folders which is something we want to avoid. Its better to give the util function a more descriptive package name. Ex `errutil`. |

## Central components of Grafana's backend

| package | description |
| ------- | ----------- |
| /internal/bus | The bus is described in more details under [Communication](/contribute/architecture/backend/communication.md) |
| /internal/models | This is where we keep our domain model. This package should not depend on any package outside standard library. It does contain some references within Grafana but that is something we should avoid going forward. |
| /internal/registry | Package for managing services. |
| /internal/services/alerting | Grafana's alerting services. The alerting engine runs in a separate goroutine and shouldn't depend on anything else within Grafana. |
| /internal/services/sqlstore | Currently where the database logic resides. |
| /internal/setting | Anything related to Grafana global configuration should be dealt with in this package. |
