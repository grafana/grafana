# Scorecard Known Limitations

## Private or deleted plugin repositories

Plugins whose GitHub repository URL is listed in the Grafana plugin catalog but is private or has been deleted will show N/A in the scorecard badge. The sidecar cannot clone the repo and OpenSSF has no record of it, so no score can be produced.

Example: `aws-datasource-provisioner-app` lists `https://github.com/grafana/aws-datasource-provisioner-app` in GCOM but the repo returns 404 from GitHub even using a GitHub token with public repo scope. The plugin catalog sidebar still shows the link, which is misleading to users who expect to be able to audit the source code.

## New or recently migrated repositories score low on Maintained

OpenSSF Scorecard's `Maintained` check penalises repositories created within the last 90 days, scoring them 0 regardless of actual commit activity. This affects plugins whose repositories were recently extracted from a monorepo or migrated to a new location — even if the plugin itself has years of active development history.

Example: `grafana-tempo-datasource` was extracted from the Grafana monorepo into its own repository. The standalone repo is actively maintained but scores 0 on `Maintained` because the repo itself is less than 90 days old. This pulls the Community dimension down to Critical despite the plugin being a first-party Grafana datasource under active development. Scores for these plugins will improve automatically once the repo is older than 90 days.

## Disabled OpenSSF Scorecard checks

Two OpenSSF Scorecard checks are explicitly excluded from scoring for all Grafana plugins. Both are disabled via a blocklist in `pkg/services/pluginsintegration/pluginscoring/types.go` with comments explaining the rationale.

**Packaging** — OpenSSF defines this as publishing to a recognised package registry (npm, PyPI, etc.). The Grafana plugin catalog is not recognised by OpenSSF as a package registry, so this check is noisy because it always fails for every plugin regardless of quality. Plugin authors cannot address this finding within the Grafana ecosystem.

**Fuzzing** — Fuzz testing is not applicable to Grafana plugins. Frontend plugins (React/TypeScript) have no meaningful fuzz surface, and backend datasource plugins (Go) are not directly exposed to untrusted input at the plugin boundary. This check is noisy because it always fails for every plugin regardless of quality.
