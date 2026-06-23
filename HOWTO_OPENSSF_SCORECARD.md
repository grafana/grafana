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

## Stop the sidecar

```bash
make devenv-down
```
