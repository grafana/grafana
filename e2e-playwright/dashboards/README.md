# Dashboards

## Adding Dashboard JSONs

When adding dashboard JSON files to this folder that were exported from Grafana:

⚠️ **Important:** Don't forget to remove the `"id"` field from the exported JSON before adding it to this folder.

Exported dashboard JSONs contain an `id` field that should be removed to avoid conflicts when importing the dashboard in tests.
