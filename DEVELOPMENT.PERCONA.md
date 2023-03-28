# Into

This guide is a step-by-step instruction that helps you with local development environment.

# Setup

Follow these steps:

1: run docker images with PMM and MySQL (in foreground mode):

```shell
docker-compose up
```

Alternatively, you can run devcontainer in background, in this case you can reuse terminal session:

```shell
docker-compose up -d
```

2: in separate terminal:

```shell
make deps-js # run this only after initial clone, it installs dependencies
yarn start
```

3: make modification in the frondend `./public/app`, once recompilation has finished refresh page with grafana

# Updating grafana-server

After devcontainer is running. Enter container:

```shell
docker exec -it pmm-server bash
```

Navigate to mounted sources:

```shell
cd /workspace
```

Compile binaries

```shell
make build-go
rm -f /usr/sbin/grafana-server
rm -f /usr/sbin/grafana
cp ./bin/linux-amd64/grafana-server /usr/sbin/grafana-server
cp ./bin/linux-amd64/grafana /usr/sbin/grafana
supervisorctl restart grafana
```
