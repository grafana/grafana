# OpenSSF Scorecard Sidecar — Local Setup

A Docker sidecar that wraps the [OpenSSF Scorecard](https://securityscorecards.dev/) CLI as an HTTP service, for local security scanning of plugin repositories.

## Prerequisites

- Docker
- A GitHub personal access token with `public_repo` scope — [create one here](https://github.com/settings/tokens)

> **SSO requirement:** If you're scanning repos under a SAML SSO-enforced GitHub organisation (e.g. `grafana/`), your token must also be SSO-authorized. Visit `https://github.com/settings/tokens`, find your token, and click **Configure SSO → Authorize** for the relevant org. Without this, the sidecar will return a 403 for those repos.

## Start the sidecar

```bash
export GITHUB_AUTH_TOKEN=ghp_yourtoken
make devenv sources=scorecard_sidecar
```

## Configure Grafana

Add to `conf/custom.ini`:

```ini
[plugin_security]
scorecard_sidecar_url = http://localhost:8088/cgi-bin/score.sh

[feature_toggles]
pluginScorecard = true
```

## Start Grafana

```bash
make run
```

## Test it

```bash
curl "http://localhost:8088/cgi-bin/score.sh?repo=github.com/grafana/grafana-infinity-datasource"
```

This repo is under the `grafana` org and exercises the SSO requirement. Expect a 30–60s response while Scorecard queries the GitHub API. `make devenv` exits immediately — the sidecar keeps running in the background until `make devenv-down`.

If `GITHUB_AUTH_TOKEN` is missing you'll get an immediate error rather than a silent hang:

```json
{ "error": "GITHUB_AUTH_TOKEN is not set. Start the container with -e GITHUB_AUTH_TOKEN=<token>" }
```

## Test the Grafana API endpoint

With `make run` running, verify the backend is serving scorecard data for an installed plugin:

```bash
# Find installed plugin versions
curl -s -u admin:admin "http://localhost:3000/api/plugins" | grep -A2 '"id"'

# Fetch scorecard insights for a specific plugin (example: azure monitor)
curl -s -u admin:admin \
  "http://localhost:3000/api/gnet/plugins/grafana-azure-monitor-datasource/versions/13.1.0-pre/insights" \
  | jq .
```

This endpoint works regardless of the `pluginScorecard` feature toggle — the toggle only gates the UI component. To enable the UI, add to `conf/custom.ini`:

```ini
[feature_toggles]
pluginScorecard = true
```

Scorecard data is populated on Grafana startup and refreshed every 24h. If the response contains an empty `insights: []` array, the background service hasn't scored the plugin yet — wait a moment and retry, or check that the sidecar is running for plugins not in the public Scorecard database.

## Stop the sidecar

```bash
make devenv-down
```

## References

- [OpenSSF Scorecard checks](https://scorecard.dev/#the-checks) — all 18 checks with risk levels and remediation guidance, grouped by theme (holistic security, source risk, build risk)
- [OpenSSF Best Practices Badge](https://www.bestpractices.dev/en) — self-certification program that satisfies the `CII-Best-Practices` Scorecard check
