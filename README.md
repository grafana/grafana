Work in progress Grafana 2.0 (with included Grafana backend)

[![wercker status](https://app.wercker.com/status/0f109051cfaf2a6d94c0eebdc0dcaeae/s "wercker status")](https://app.wercker.com/project/bykey/0f109051cfaf2a6d94c0eebdc0dcaeae)

## building and running

```
go run build.go setup (only needed once to install godep)
go run build.go build
```

For quicker builds:

```
godep restore (will pull down all golang lib dependecies in your current GOPATH)
go build -o ./bin/grafana .
```

To build less to css for frontend:

```
cd grafana
npm install
npm install -g grunt-cli
grunt
```

To rebuild on source change:
```
go get github.com/Unknwon/bra

bra run
```



