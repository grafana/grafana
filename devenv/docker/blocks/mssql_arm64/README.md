This build is basically a clone of the `mssql` folder but without the custom `grafana` db/user created.

At this moment, there is no `MSSQL Server` available for `arm64` processors. The workaround is using an `azure-sql-edge` image instead.

The `setup` files cannot be used to create a custom `grafana` db/user since `sqlcmd` does not work for `arm64` processors.
(https://docs.microsoft.com/en-us/azure/azure-sql-edge/connect)

You can connect the Grafana MSSQL datasource to this instance by using the following credentials:
  * Host: `localhost`
  * Database: `master`
  * User: `sa`
  * Password: `Password!` or whatever is set in `docker-compose.yaml` for env var `MSSQL_SA_PASSWORD`