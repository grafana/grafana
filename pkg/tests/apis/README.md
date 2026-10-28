# K8s integration tests

This directory contains integration tests for the Kubernetes API services.

For isolated, parallel API-server tests, use the shared
[API integration test environment](../apiserver/README.md). Keep migrated tests
in their existing packages and register production builders or app installers.
The playlist and IAM user suites use the isolated environment directly, including resource
clients, requests, and fixture loading, without depending on this package's
helpers. They also register the production legacy HTTP facades with the same API
server. Keep full Grafana startup for application wiring or auth
providers whose dependencies have not been supplied to the isolated environment.
