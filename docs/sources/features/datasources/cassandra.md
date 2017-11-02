+++
title = "Using Cassandra in Grafana"
description = "Guide for using Cassandra in Grafana"
keywords = ["grafana", "cassandra", "guide"]
type = "docs"
[menu.docs]
name = "Cassandra"
parent = "datasources"
weight = 7
+++

# Using Cassandra in Grafana

Grafana ships with a built-in Cassandra data source plugin that allow you to query and visualize
data from a Cassandra.

## Adding the data source

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select `Cassandra` from the `Type` dropdown.

### Database User Permissions (Important!)

The database user you specify when you add the data source should only be granted SELECT permissions on
the specified database and tables you want to query. Grafana does not validate that the query is safe. The query
could include any CQL statement. For example, statements like `USE otherdb;` and `DROP TABLE user;` would be
executed. To protect against this we **Highly** recommend you create a specific cassandra user with
restricted permissions.

##### Example:

```cql
 CREATE USER IF NOT EXISTS grafana_reader WITH PASSWORD password;
 GRANT SELECT PERMISSION ON KEYSPACE keyspace_name TO grafana_reader;
```

To use password authentication in cassandra edit cassandra.yaml:
```
authenticator: PasswordAuthenticator
role_manager: CassandraRoleManager
```

## Macros

To simplify syntax and to allow for dynamic parts, like date range filters, the query can contain macros.

Macro example | Description
------------ | -------------
*$__timeFilter(timestamp_column)* | Will be replaced by a time range filter using the specified column name. For example, *WHERE time_column > 18446737278344672745 AND time_column <= 18446737278344972745*

The query editor has a link named `Generated CQL` that show up after a query as been executed, while in panel edit mode. Click
on it and it will expand and show the raw interpolated CQL string that was executed.

## Table queries

If the `Format as` query option is set to `Table` then you can basically do any type of CQL query. The table panel will automatically show the results of whatever columns and rows your query returns.

You can control the name of the Table panel columns by using regular `as ` CQL column selection syntax.

##### Example:

New dashboard -> Singlestat -> Edit -> Data source: cassandra -> Format as: Table
Query: `SELECT now() FROM system.local` 

### Time series queries

If you set `Format as` to `Time series`, for use in Graph panel for example, then there are some requirements for
what your query returns.

- Must be a column named `time_ms` representing a unix epoch in milliseconds.
- Must be a column named `value` representing the time series value.
- Must be a column named `metric` representing the time series name.

##### Example:

New dashboard -> Graph -> Edit -> Data source: cassandra -> Format as: Time series 
Query: `SELECT key_column, $__time(timestamp_column), name_column AS metric, value_column AS value FROM test.grafana_test WHERE key_column = 'key1' AND filter_column = 'filter1' AND $__timeFilter(timestamp_column)`

```cql
CREATE KEYSPACE IF NOT EXISTS test WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 3 };

CREATE TABLE IF NOT EXISTS test.grafana_test (
    key_column text,
    filter_column text,
    timestamp_column timestamp,
    name_column text,
    value_column decimal,
    PRIMARY KEY (key_column, filter_column, timestamp_column, name_column)
)  WITH compaction = { 'class' : 'LeveledCompactionStrategy' };

INSERT INTO test.grafana_test (key_column, filter_column, timestamp_column, name_column, value_column) VALUES ('key1', 'filter1', toTimestamp(now()), 'AA', 30);
INSERT INTO test.grafana_test (key_column, filter_column, timestamp_column, name_column, value_column) VALUES ('key1', 'filter1', toTimestamp(now()), 'BB', 80);

INSERT INTO test.grafana_test (key_column, filter_column, timestamp_column, name_column, value_column) VALUES ('key1', 'filter1', toTimestamp(now()), 'AA', 150);
INSERT INTO test.grafana_test (key_column, filter_column, timestamp_column, name_column, value_column) VALUES ('key1', 'filter1', toTimestamp(now()), 'BB', 100);

INSERT INTO test.grafana_test (key_column, filter_column, timestamp_column, name_column, value_column) VALUES ('key1', 'filter1', toTimestamp(now()), 'AA', 70);
INSERT INTO test.grafana_test (key_column, filter_column, timestamp_column, name_column, value_column) VALUES ('key1', 'filter1', toTimestamp(now()), 'BB', 130);
```
