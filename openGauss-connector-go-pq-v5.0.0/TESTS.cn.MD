# 测试

## 运行测试

`go test`适用于测试。 需要一个运行中的openGauss服务器用于登录。
  
将“localhost”上的“pqgotest”数据库连接到测试，可以使用[环境变量](https://www.postgresql.org/docs/9.3/static/libpq-envars.html)覆盖数据库。

示例：

 PGHOST=/run/postgresql go test

## 基准

基准套件可作为测试的一部分运行：

 go test -bench .

## 设置示例（Docker）

运行openGauss容器：

```
docker run --name openGauss_test \
--privileged=true -d -e GS_PASSWORD=Test@123 \
-p 5432:5432 \
enmotech/opengauss:latest
```

运行测试：

```
TEST_CONN_STRING=postgresql://gaussdb:Test@123@localhost:5432/postgres?sslmode=disable go test
```
