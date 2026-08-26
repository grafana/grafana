# Demo dashboards (data platform)

Local-only pack so `make run` looks like a warehouse / analytics org.

- **Datasource:** Testdata, provisioned as `Analytics warehouse` (`demo-testdata`)
- **Folders:** Warehouse (overview, query performance), Pipelines (ELT freshness, failed jobs)
- **Not** a Snowflake / BigQuery / Redshift connector. Query inspector will show Testdata scenarios.

Home dashboard is set via `conf/demo.ini`. Copy it to `conf/custom.ini` (gitignored) if this machine does not already have one:

```bash
cp conf/demo.ini conf/custom.ini
```

Then restart the backend.

To remove the pack:

```bash
rm conf/provisioning/datasources/demo.yaml conf/provisioning/dashboards/demo.yaml
```

Do not send these provisioning files upstream.
