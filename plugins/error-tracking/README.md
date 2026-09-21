# Error tracking app plugin

This directory contains the independently built Error tracking app plugin. Its UI uses Grafana's public runtime, data, i18n, and UI packages. The page never accepts a tenant namespace from user input: the API server derives the tenant from the verified signed identity.

Build the complete Grafana image, including the UI bundle, from the repository root with the pinned public Enterprise base:

```sh
docker build -f plugins/error-tracking/Dockerfile -t error-tracking-grafana:local .
```

The image contains the frontend-only `grafana-errortracking-app` under Grafana's plugin directory and keeps Grafana's default non-root runtime user. Pass `--platform` when the target cluster architecture differs from the build host.

For a UI-only iteration, run the workspace build below; it writes an installable bundle to `dist/`:

```sh
yarn workspace @grafana-plugins/grafana-errortracking-app build
```

The complete image packages Grafana and the plugin UI. The standalone API in `apps/errortracking` runs as a separate service behind Grafana's native API aggregation. The page calls `GET` and `POST /apis/error-tracking.grafana.app/v0alpha1/namespaces/<runtime-namespace>/events` through Grafana's authenticated backend service. The API validates the signed identity and that the route namespace matches it before accessing tenant-scoped storage.

The API request boundary is intentionally kept in `src/ErrorTrackingPage.tsx`: it uses the public `@grafana/runtime` backend service and Grafana's runtime namespace for URL selection. The browser does not supply tenant identity.
