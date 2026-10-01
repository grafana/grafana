# Run the Assistant with OSS mode off

Investigations (**Investigate** and **Open investigation** on an answer) need the Assistant with OSS mode off. A local setup runs it in OSS mode, so it needs these changes on top. For the demo itself, see [DEMO.md](DEMO.md).

## 1. Turn off OSS mode

In the Assistant entry of `conf/provisioning/plugins/assistant.yaml` in the `grafana` folder, set `ossMode` to `false`:

```yaml
apps:
  - type: 'grafana-assistant-app'
    jsonData:
      ossMode: false
```

Grafana reads provisioning files only at startup, so restart it afterwards.

With `ossMode: true`, **Investigate** fails with "Investigations are not available in this Grafana Assistant setup." and stays hidden on every answer for the rest of the visit.

## 2. Start Grafana with `GF_DEFAULT_APP_MODE=development`

Forward Grafana's environment to the Assistant plugin in `conf/custom.ini`:

```ini
[plugins]
forward_host_env_vars = grafana-assistant-app
```

Then start Grafana with the variable, every time:

```bash
GF_DEFAULT_APP_MODE=development make run
```

With OSS mode off, the plugin backend verifies identity tokens. It counts as local only when `GF_DEFAULT_APP_MODE=development` is in its environment; `app_mode` in `custom.ini` does not count. Otherwise it fetches signing keys from the Auth API inside Grafana Cloud, and every request fails with "unable to fetch signing keys: request error".

## 3. Point the Assistant API at Grafana's signing keys

This applies when Grafana runs on the host and the API runs with `mise run up:api`, which does not start the private Auth API. Without this change, answers still work, but starting an investigation fails with "failed to create auth provider".

Create `grafana-assistant-app/docker-compose.override.yml`. It is gitignored, and Compose loads it automatically:

```yaml
# Local-only (gitignored). Compose loads this automatically for `mise run up:api`.
#
# Grafana runs on the host (`make run` in the grafana checkout) instead of the
# compose `grafana` service, and the private Auth API stack is not running.
services:
  api:
    extra_hosts:
      # The API rewrites localhost Grafana URLs to http://grafana:3000, so point
      # that name at the host Grafana.
      - 'grafana:host-gateway'
    environment:
      # Same as docker-compose.cloud.yaml: skip the Auth API and verify ID tokens
      # against Grafana's own signing keys.
      DASH_API_AUTH_CLOUD_ACCESS_POLICY_TOKEN: ''
      DASH_API_AUTH_GCX_CLOUD_ACCESS_POLICY_TOKEN: ''
      DASH_API_AUTH_MCP_CLOUD_ACCESS_POLICY_TOKEN: ''
      DASH_API_AUTH_ACCESS_TOKEN_EXCHANGE_URL: ''
      DASH_API_AUTH_ID_TOKEN_EXCHANGE_URL: ''
      DASH_API_AUTH_JWKS_URL: http://grafana:3000/api/signing-keys/keys
```

Recreate the API container to apply it; a restart keeps the old configuration:

```bash
cd <workspace>/grafana-assistant-app
mise exec -- docker compose --env-file .env -p grafana-assistant-app up -d --no-deps --force-recreate api
```

Rename or remove the file before you run the full Assistant stack (`mise run up`), which has its own Grafana and Auth API.

## Check that it works

Ask any insight, choose **Investigate** under the answer, and wait for the investigation summary. **Open investigation** opens it in the Assistant.
