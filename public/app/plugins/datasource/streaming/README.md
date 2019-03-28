# Streaming Datasource - Native Plugin

This is a super alpha datasource to explore how to best support streaming data...


You can run the test backend server using:

```
cd public/app/plugins/datasource/streaming/
go run server.go
```
You can test this with:
```
curl --no-buffer 'http://localhost:7777/?speed=250&spread=5'
```


Eventually it would be great for this to:
* use all the credentials from backendSrv
* support websockets
* support periodic calls to another query using the last recieved time
