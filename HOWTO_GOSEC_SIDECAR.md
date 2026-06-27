# gosec SAST Sidecar — Local Setup

A Docker sidecar that runs [gosec](https://github.com/securego/gosec) (Go Security Checker) against plugin repositories for Go static security analysis. Relevant for datasource and app plugins that include a Go backend.

## Prerequisites

- Docker
- A GitHub personal access token with `public_repo` scope — [create one here](https://github.com/settings/tokens)

> **SSO requirement:** If scanning repos under a SAML SSO-enforced GitHub organisation (e.g. `grafana/`), your token must be SSO-authorized. Visit `https://github.com/settings/tokens`, find your token, and click **Configure SSO → Authorize** for the relevant org.

> **Note:** gosec requires downloading Go module dependencies at scan time (`go mod download`). Scans of plugins with large dependency trees may take several minutes.

## Start the sidecar

```bash
export GITHUB_AUTH_TOKEN=ghp_yourtoken
make devenv sources=gosec_sidecar
```

## Configure Grafana

Add to `conf/custom.ini`:

```ini
[plugin_security]
gosec_sidecar_url = http://localhost:8090/cgi-bin/scan.sh
```

## Start Grafana

```bash
make run
```

## Test it

```bash
curl "http://localhost:8090/cgi-bin/scan.sh?repo=github.com/grafana/grafana-infinity-datasource"
```

Returns a JSON object with gosec's output:

- `Issues` — array of security findings, each with `rule_id`, `severity`, `confidence`, `file`, `line`, `details`
- `Stats` — summary counts
- `GosecVersion` — version of gosec used

Plugins with no `.go` source files (panel plugins, pure JS/TS datasources) return immediately:

```json
{ "Issues": [], "Stats": {}, "GosecVersion": "", "message": "no Go source files found" }
```

`make devenv` exits immediately — the sidecar keeps running in the background until `make devenv-down`.

If `GITHUB_AUTH_TOKEN` is missing:

```json
{ "error": "GITHUB_AUTH_TOKEN is not set. Start the container with -e GITHUB_AUTH_TOKEN=<token>" }
```

## Clear the score cache

gosec results are cached alongside Scorecard results in Grafana's local SQLite database. To force a fresh re-scan:

```bash
sqlite3 data/grafana.db "DELETE FROM kv_store WHERE namespace='plugin-scorecard';"
```

## Stop the sidecar

```bash
make devenv-down
```

## References

- [gosec rules](https://github.com/securego/gosec#available-rules) — full list of Go security checks
- [CWE-78](https://cwe.mitre.org/data/definitions/78.html) — OS Command Injection (G204)
- [CWE-89](https://cwe.mitre.org/data/definitions/89.html) — SQL Injection (G201/G202)
- [CWE-22](https://cwe.mitre.org/data/definitions/22.html) — Path Traversal (G304/G305)
- [CWE-327](https://cwe.mitre.org/data/definitions/327.html) — Weak Cryptography (G401-G407)
- [CWE-242](https://cwe.mitre.org/data/definitions/242.html) — Use of `unsafe` (G103)
