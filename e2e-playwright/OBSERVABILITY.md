# Local test observability trial

This opt-in configuration sends Playwright results and attachments to the development
E2E test observability app. A Faro collector additionally enables browser session replay
and correlated test spans. Existing test files and the default Playwright configuration
are unchanged. This branch is a local experiment, not a CI rollout: installing its private
development dependency requires registry access, including for otherwise ordinary installs.

## Install

Use Node 24.18.1 or newer within Grafana's supported Node range (currently below 25).
The repository's `.nvmrc` still selects 24.11.0; activate the newer runtime explicitly
for installation and trial commands. Playwright stays on 1.56.1.

Authenticate with your Grafana Google account and supply Yarn's short-lived registry token:

```sh
gcloud auth login
export GRAFANA_CLOUD_NPM_TOKEN="$(gcloud auth print-access-token)"
yarn install --immutable
unset GRAFANA_CLOUD_NPM_TOKEN
```

The committed `npmScopes.grafana-cloud` configuration points at the private development
registry. Yarn reads the token from the environment, not from `.npmrc`. Refresh the token
if installation returns 401 or 403. Do not put tokens in tracked files.

The three-day package age gate remains enabled. A fresh install may reject version 0.8.2
until that window expires; wait rather than disabling the gate. The original trial used
an explicitly approved, temporary exception for this exact version, removed after install.

## Run without credentials

Prepare Grafana's backend, frontend, and test plugins as for existing Playwright tests.
Inspect this worktree's `conf/custom.ini` before starting a development server. When
`grafana.rspackBuild` is enabled, use `yarn start:rspack` and match the backend setting.
The automatic e2e server uses `scripts/grafana-server/custom.ini`, which also enables Rspack.

```sh
unset GRAFANA_TEST_API_TOKEN GRAFANA_FARO_COLLECTOR_URL
yarn e2e:playwright:observability --project=smoke smoketests.spec.ts
```

The inherited configuration starts the local test server on port 3001. To use an already
running test instance instead, set `GRAFANA_URL` to its URL. Use an isolated instance with
synthetic data; the smoke test creates a data source and dashboard content.

The reporter writes `test-observability-results/replays.json` and one self-contained
bundle under `test-observability-results/bundles/<source_id>/`. Both are ignored by Git.
Each bundle includes `state.json`, `request.json`, `artifacts.json`, and copied attachments.
With no credentials, no results or replay are uploaded. Existing HTML and accessibility
reporters remain enabled.

Do not add `--reporter` to this command: it replaces the configured reporters. UI mode,
`--list`, and `merge-reports` do not record bundles. Repeated runs create separate bundles;
`replays.json` describes the latest run.

## Reproduce the fully local trial

This runs the results API (Testament) and its Grafana app locally. No Cloud results token,
Faro collector, Loki, or Tempo is required. It covers results and attachments, not session
replay. Use a fresh, disposable Grafana worktree: panel tests modify its synthetic data.
Do not overwrite an existing instance's configuration or reuse its database.

Prerequisites: complete **Install** above; Docker, `uv`, Git/SSH access to
`grafana/grafana-test-observability`, `grafana/grafana-e2e-test-o11y`,
`grafana/k6-cloud-lib-odata`, and `grafana/k6-cloud-lib-config-parser`; Grafana's Go toolchain
and frontend build prerequisites. Testament needs Python 3.13 (`uv` can install it).
The app build below targets Apple Silicon; use Mage's matching build target on other hosts.
Ports 3317, 55432, and 18765 must be free.

### 1. Start the results API

From the Grafana worktree root, keep these variables in the terminals used below:

```sh
export OBS_GRAFANA_DIR="$PWD"
export OBS_TOOLS_DIR="$OBS_GRAFANA_DIR/data/observability-tools"
mkdir -p "$OBS_TOOLS_DIR"
git clone git@github.com:grafana/grafana-test-observability.git "$OBS_TOOLS_DIR/reporter-source"
git -C "$OBS_TOOLS_DIR/reporter-source" checkout 484edb381a0453e14fcbcdfb30a939bdef92a121

docker run -d --name grafana-e2e-observability-postgres \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=testament \
  -p 127.0.0.1:55432:5432 \
  -v grafana-e2e-observability-postgres-data:/var/lib/postgresql postgres:18
docker exec grafana-e2e-observability-postgres pg_isready -U postgres -d testament

cd "$OBS_TOOLS_DIR/reporter-source/testament"
uv sync --locked --group dev
export DATABASE_URL='postgresql+psycopg://postgres:dev@127.0.0.1:55432/testament'
uv run alembic upgrade head
uv run python -m testament.dev_server --artifacts "$OBS_TOOLS_DIR/testament-artifacts"
```

Wait for `pg_isready` to report that connections are accepted before migrating. On later
starts, use `docker start grafana-e2e-observability-postgres` instead of `docker run`.
Keep the API terminal running. Verify `curl --fail http://127.0.0.1:18765/readyz` returns
`{"status":"ok"}`. The API accepts bearer token `dev` for tenant `dev`; these are local
development credentials only. Do not run Testament's database tests against this database:
they remove its schema.

### 2. Build and install the app

In another terminal with the variables from step 1:

```sh
git clone git@github.com:grafana/grafana-e2e-test-o11y.git "$OBS_TOOLS_DIR/app"
git -C "$OBS_TOOLS_DIR/app" checkout 4fd224e84769ec1eeaafaa3cfda1d737020fffd4
mkdir -p "$OBS_TOOLS_DIR/bin"
GOWORK=off GOBIN="$OBS_TOOLS_DIR/bin" go install github.com/magefile/mage@v1.15.0
cd "$OBS_TOOLS_DIR/app"
npm ci
npm run build
GOWORK=off "$OBS_TOOLS_DIR/bin/mage" -v build:darwinARM64
chmod 0755 dist/gpx_e2e_test_o11y_darwin_arm64
mkdir -p "$OBS_GRAFANA_DIR/data/plugins/grafana-e2e-test-o11y-app"
rsync -a dist/ "$OBS_GRAFANA_DIR/data/plugins/grafana-e2e-test-o11y-app/"
```

The plugin uses its own webpack build; Grafana itself uses Rspack. The pinned app's existing
lockfile reported 57 vulnerabilities during this trial; this is a local development setup,
not a production deployment or dependency remediation.

### 3. Prepare isolated Grafana

From the fresh worktree root:

```sh
cd "$OBS_GRAFANA_DIR"
make build-backend
yarn dev:rspack
yarn e2e:plugin:build
yarn playwright install chromium
mkdir -p data/e2e-provisioning/dashboards data/e2e-provisioning/datasources data/e2e-provisioning/plugins
cp devenv/dashboards.yaml data/e2e-provisioning/dashboards/dashboards.yaml
cp devenv/datasources.yaml data/e2e-provisioning/datasources/datasources.yaml
cp devenv/plugins.yaml data/e2e-provisioning/plugins/plugins.yaml
rsync -a --exclude node_modules e2e-playwright/test-plugins/ data/plugins/
cp scripts/grafana-server/custom.ini conf/custom.ini
```

Edit the new, ignored `conf/custom.ini`: append `,grafana-e2e-test-o11y-app` to the existing
`[plugins]` `allow_loading_unsigned_plugins` value. Add these sections (merge rather than
duplicate them if already present):

```ini
[server]
http_addr = 127.0.0.1
http_port = 3317

[paths]
plugins = data/plugins
provisioning = data/e2e-provisioning

[auth.anonymous]
enabled = false
```

Keep `grafana.rspackBuild=true`, the existing unsigned test-plugin entries, and the CSP
settings. With CSP enforced, Grafana serves the Rspack assets built to disk above; it ignores
`frontend_dev.server_url`. Default local admin credentials are `admin` / `admin`.

Create ignored `data/e2e-provisioning/plugins/test-observability.yaml`:

```yaml
apiVersion: 1
apps:
  - type: grafana-e2e-test-o11y-app
    org_id: 1
    disabled: false
    jsonData:
      apiUrl: http://127.0.0.1:18765
    secureJsonData:
      apiKey: dev
```

Start Grafana in its own terminal and keep it running:

```sh
cd "$OBS_GRAFANA_DIR"
./bin/grafana server --homepath "$OBS_GRAFANA_DIR" --config conf/custom.ini
```

Restart this instance after replacing app plugin files. Check readiness at
<http://127.0.0.1:3317/api/health> and sign in at <http://127.0.0.1:3317>.

### 4. Record panels and upload locally

```sh
cd "$OBS_GRAFANA_DIR"
unset GRAFANA_TEST_API_TOKEN GRAFANA_FARO_COLLECTOR_URL
GRAFANA_URL=http://127.0.0.1:3317 PLAYWRIGHT_HTML_OPEN=never \
  yarn e2e:playwright:observability --project=panels --workers=4

DEV_TOKEN=dev yarn grafana-test-observability upload \
  test-observability-results/bundles/<source_id> \
  --base-url http://127.0.0.1:18765 --token-env DEV_TOKEN --allow-http
```

Replace `<source_id>` with the bundle directory from this run. A retained bundle can be
uploaded without rerunning tests. Do **not** supply `--stack-id`: that selects Cloud Basic
authentication instead of the local bearer token. Use this CLI for local uploads; the
config's automatic-upload options remain Cloud-oriented and do not enable plain HTTP.

Open <http://127.0.0.1:3317/a/grafana-e2e-test-o11y-app/runs> and select the run ID printed
by the upload command. Verify counts, owners, steps, and attachments. The original panel
run had 240 passed, 1 skipped (including the authentication project), 10,001 steps, and six
accessibility JSON attachments. Passing tests do not retain failure screenshots/traces.
The app backend proxies requests to Testament; browser-side Cloud credentials are unnecessary.

Stop the foreground Grafana and Testament processes with Ctrl-C, then run
`docker stop grafana-e2e-observability-postgres`. Keep the Docker volume, original bundles,
and `testament-artifacts` directory to retain results and attachment bytes. Do not stop
unrelated containers or remove volumes as part of shutdown.

## Connect the development stack

Defaults:

- Results API: `https://testament-dev-us-central-0.grafana-dev.net/testament`
- Stack ID: `26320`
- App: <https://e2eobservability.grafana-dev.net/a/grafana-e2e-test-o11y-app/>

Set `GRAFANA_TEST_API_TOKEN` to a Cloud Access Policy token scoped to this stack with
`e2e-test-results:write`. Set `GRAFANA_FARO_COLLECTOR_URL` to a Frontend Observability
collector URL on the same stack. The collector URL contains a credential; keep it secret.
Optional `GRAFANA_TEST_API_URL` and `GRAFANA_STACK_ID` override the destination together
with a matching token and collector.

Before enabling replay:

1. Add the actual browser origin (normally `http://localhost:3001`) to the Faro app's CORS origins.
2. Allow the collector's HTTPS **origin** in the test server's CSP `connect-src` directive.
   For the automatic test server, edit this worktree's `scripts/grafana-server/custom.ini`
   locally. For a separately started instance, edit its `conf/custom.ini` or supply
   `GF_SECURITY_CONTENT_SECURITY_POLICY_TEMPLATE`. Preserve the other CSP directives;
   never include the collector's secret path in server configuration.
3. Use synthetic data only. This prototype records replay inputs without masking.

Keep credentials in your shell or an external, permission-restricted shell file:

```sh
source /absolute/path/to/local-observability-credentials.sh
yarn e2e:playwright:observability --project=smoke smoketests.spec.ts
```

The reporter prints a run ID. Open the app and find the run under `grafana/grafana`.
Check test owners, attempts, steps, output, and any attachments. With Faro enabled,
check replay and correlated spans too. Screenshots and Playwright traces are retained
on failure, so a passing smoke test alone will not prove failure-artifact capture.
Results upload and Faro instrumentation are independent: either credential can be omitted.

## Recover an upload

Upload failures warn without changing the test verdict. Keep the entire bundle and retry:

```sh
yarn grafana-test-observability upload test-observability-results/bundles/<source_id> \
  --base-url "${GRAFANA_TEST_API_URL:-https://testament-dev-us-central-0.grafana-dev.net/testament}" \
  --token-env GRAFANA_TEST_API_TOKEN \
  --stack-id "${GRAFANA_STACK_ID:-26320}"
```

The CLI resumes delivery and reuses the bundle's run identity. It exits nonzero if delivery
is incomplete. Reporter upload may wait up to the package's 15-minute delivery deadline.
Partial bundles require an explicit `--allow-partial`; failed bundles cannot be uploaded.
Hard termination can leave no usable bundle. Do not edit bundle identities to retry.

## Later CI integration

Capture must happen in each test shard. The current `--reporter=dot,blob` argument would
override this reporter, and this package skips recording during `merge-reports`.
Upload finalized bundles centrally with the CLI if desired. Bench currently receives
only merged JSON, so its container has neither attachment bytes nor recorded bundles.
Keep its existing summary reporting alongside this integration.

CI rollout also needs private registry access, Vault credentials, fork handling,
Node compatibility, and retention of each shard's bundles. No workflow changes are included
in this local trial.

See [Connect a suite](https://github.com/grafana/grafana-test-observability/blob/main/docs/connect-a-suite.md)
and [Result delivery](https://github.com/grafana/grafana-test-observability/blob/main/docs/components/result-delivery.md).
