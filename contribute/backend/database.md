# Database

Grafana uses databases to persist settings between restarts. If you don't specify one, Grafana creates a [SQLite3](https://www.sqlite.org/) database file on your local disk. This guide explains how to store and retrieve data from the default or other databases.

## Supported databases and services

Grafana supports the [following databases](https://grafana.com/docs/installation/requirements/#database):

- [MySQL](https://www.mysql.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [SQLite3](https://www.sqlite.org/)

Grafana uses the [XORM](https://xorm.io) framework for persisting objects to the database. For more information on how to use XORM, refer to the [documentation](https://gobook.io/read/gitea.com/xorm/manual-en-US/).

[Services](services.md) don't use XORM directly. Instead, services use the _SQL store_, a special type of service that provides an abstraction for the database layer. There are two ways of using the `sqlstore`: using `sqlstore` handlers, and using the `SQLStore` instance.

## `sqlstore` handlers

> **Deprecated:** We are deprecating `sqlstore` handlers in favor of using the `SQLStore` object directly in each service. Since most services still use the `sqlstore` handlers, we still want to explain how they work.

The `sqlstore` package allows you to register [command handlers](communication.md#commands-and-queries) that either store or retrieve objects from the database. The `sqlstore` handlers are similar to services:

- [Services](services.md) are command handlers that _contain business logic_.
- `sqlstore` handlers are command handlers that _access the database_.

### Register a `sqlstore` handler

> **Deprecated:** Refer to the [deprecation note for `sqlstore` handlers](#sqlstore-handlers).

To register a handler:

- Create a new file, `myrepo.go`, in the `sqlstore` package.
- Create a [command handler](communication.md#commands-and-queries).
- Register the handler in the `init` function:

```go
func init() {
    bus.AddHandlerCtx("sql", DeleteDashboard)
}

func DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error {
    return inTransactionCtx(ctx, func(sess *DBSession) error {
        _, err := sess.Exec("DELETE FROM dashboards WHERE dashboard_id=?", cmd.DashboardID)
        return err
    })
}
```

Here, `inTransactionCtx` is a helper function in the `sqlstore` package that provides a session, that lets you execute SQL statements.

## `SQLStore`

As opposed to a `sqlstore` handler, the `SQLStore` is a service itself. Like the handler, the `SQLStore` is responsible for storing and retrieving objects, to and from the database.

To use the `SQLStore`, inject it in your service struct:

```go
type MyService struct {
    SQLStore *sqlstore.SQLStore `inject:""`
}
```

You can now make SQL queries in any of your [command handlers](communication.md#commands-and-queries) or [event listeners](communication.md#subscribe-to-an-event):

```go
func (s *MyService) DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error {
    if err := s.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
        _, err := sess.Exec("DELETE FROM dashboards WHERE dashboard_id=?", cmd.DashboardID)
        return err
    })
}
```

For transactions, use the `WithTransactionalDbSession` method instead.

## Migrations

As your use of Grafana evolves, you may need to create _schema migrations_ for one or more database tables.

To see all the types of migrations you can add, refer to [migrations.go](/pkg/services/sqlstore/migrator/migrations.go).

Before you add a migration, make sure that you:

- Never change a migration that has been committed and pushed to `main`.
- Always add new migrations, to change or undo previous migrations.

Add a migration using one of the following methods:

- Add migrations in the `migrations` package.
- Implement the `DatabaseMigrator` for the service.

> **Important:** If there are previous migrations for a service, use that method. Don't add migrations using both methods or you risk running migrations in the wrong order.

### Add migrations in `migrations` package

Most services have their migrations located in the [migrations](/pkg/services/sqlstore/migrations/migrations.go) package.

To add a migration:

- Open the [migrations.go](/pkg/services/sqlstore/migrations/migrations.go) file.
- In the `AddMigrations` function, find the `addXxxMigration` function for the service you want to create a migration for.
- At the end of the `addXxxMigration` function, register your migration (refer to the following example).

- [Example](https://github.com/grafana/grafana/blob/00d0640b6e778ddaca021670fe851fe00982acf2/pkg/services/sqlstore/migrations/migrations.go#L55-L70)

> **Note:** We no longer recommend putting migrations behind feature flags because this could cause the migration to skip integration testing.

### Implement `DatabaseMigrator`

During initialization, SQL store queries the service registry, and runs migrations for every service that implements the [DatabaseMigrator](https://github.com/grafana/grafana/blob/d27c3822f28e5f26199b4817892d6d24a7a26567/pkg/registry/registry.go#L46-L50) interface.

To add a migration:

- If needed, add the `AddMigration(mg *migrator.Migrator)` method to the service.
- At the end of the `AddMigration` method, register your migration:

```go
func (s *MyService) AddMigration(mg *migrator.Migrator) {
    // ...

    mg.AddMigration("Add column age", NewAddColumnMigration(table, &Column{
        Name:     "age",
        Type:     migrator.DB_BigInt,
        Nullable: true,
    }))
}
```
