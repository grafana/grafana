# Grafana load tests written in typescript - EXPERIMENTAL

Runs load tests written in typescript and checks Grafana's performance using [k6](https://k6.io/)

This is **experimental** - please consider adding new tests to devenv/docker/loadtest while we are testing the typescript approach!



# How to run

```
yarn install
GRPC_TOKEN={REPLACE_WITH_SERVICE_ACCOUNT_ADMIN_TOKEN} ./run.sh test=object-store-test grpcAddress=127.0.0.1:10000 execution=local
```
