# Grafana demo deploy on Railway

Deploy the **fieldsphere/grafana** fork as a live demo for coding tools (custom code → build → URL).

Target repo: [fieldsphere/grafana](https://github.com/fieldsphere/grafana).

## One-time Railway setup

1. Create a [Railway](https://railway.com) project (Hobby or Pro).
2. **New → GitHub Repo** → `fieldsphere/grafana`, branch `main`.
3. Railway detects the root `Dockerfile` and `railway.toml` (health check `/api/health`, long timeout for cold builds).
4. **Add a volume** (if using SQLite): mount at `/var/lib/grafana` on the Grafana service.
5. **Variables**: copy from [`env.example`](./env.example). Minimum: `GF_SERVER_ROOT_URL`, `GF_SECURITY_ADMIN_PASSWORD`, and disable anonymous/signup (already in the example).
6. **Networking**: generate a public domain; set `GF_SERVER_ROOT_URL` to `https://<that-domain>`.
7. **PR environments**: Project Settings → **Environments** → enable **PR Environments** (and optionally **Focused PR Environments** so only this service rebuilds).

Auth is **Grafana’s own login page** (admin user + password you set in Railway). Railway does not sit in front with a separate login wall.

For a public demo, you only need a strong `GF_SECURITY_ADMIN_PASSWORD` plus `GF_AUTH_ANONYMOUS_ENABLED=false` and `GF_USERS_ALLOW_SIGN_UP=false` so strangers cannot browse without logging in or create accounts.

### Optional: GitHub on the Grafana login page

If you want **Sign in with GitHub** (still inside Grafana, not Railway auth), uncomment the `GF_AUTH_GITHUB_*` lines in `env.example` and create a GitHub OAuth app with callback `https://<domain>/login/github`.

**PR previews + GitHub OAuth:** each preview gets a new `*.up.railway.app` host; GitHub requires an exact callback URL per host. Easiest pattern: use **admin password only** on PR environments, or add each preview URL to the OAuth app when Railway posts the link.

## What “expensive” means for PR previews

Railway bills **usage per second** (RAM, CPU, volume, egress), not “per deploy” as a flat fee. For this repo, cost drivers are:

### 1. Docker build time (usually the big one)

The root `Dockerfile` runs a **full Go compile + `yarn build`** (multi-stage). Expect roughly **20–45+ minutes** of builder time on a cold cache—much longer than a typical Next.js app.

- Every **new PR environment** triggers a new image build unless Railway reuses cache from a recent build on the same builder.
- **Money:** build consumes CPU/RAM on Railway’s build infrastructure for that entire window.
- **Time:** the PR stays “deploying” until the image is ready; agents waiting on a preview URL should expect long waits.

### 2. Running preview services

While a PR is open, Railway keeps a **copy of the stack** (your Grafana service, and Postgres if attached).

- Example: **1 GB RAM** ≈ **$10/month** if it ran 24/7; a PR open for **2 days** is roughly **$0.60** for RAM alone (plus CPU).
- **Several open PRs** = several full Grafana instances in parallel.

PR environments are **deleted when the PR closes/merges**, which stops run costs.

### 3. Database / disk per preview

- **SQLite + volume:** each PR environment may provision its own volume (small $, isolated data).
- **Postgres plugin:** if the PR environment clones Postgres too, you pay for another DB while the PR is open.

### 4. Egress

Dashboard UI + datasource queries from the preview count toward egress (usually smaller than build + RAM unless you pull large metrics).

### Practical guidance

| Pattern | Build cost | Run cost | Good for |
|---------|------------|----------|----------|
| PR preview on **every** commit | High | Medium while PR open | Proving “deploy my branch” in demos |
| PR preview only with label / manual Railway deploy | Lower | Lower | Day-to-day dev |
| **Main only** auto-deploy; PRs use local `make run` | Lowest | One stable instance | Most internal work |

For coding-tool demos, a common compromise is: **auto-deploy `main`**, enable PR environments for **release demos**, and accept **one long first build** per PR.

## Deploy flow (what to show in a demo)

1. Push a branch to `fieldsphere/grafana` and open a PR.
2. Railway builds the Docker image and deploys a PR environment (link appears in the PR checks / Railway GitHub comment).
3. Open the URL → sign in on the **Grafana login page** (admin password you set in Railway).
4. Merge or close PR → Railway tears down the preview.

CLI alternative (project linked locally):

```bash
npm i -g @railway/cli
railway login
railway link
railway up
```

## Suggested resources

| Setting | Suggestion |
|---------|------------|
| RAM | ≥ 1 GB (2 GB if dashboards + alerting feel tight) |
| Volume | 1–5 GB for SQLite demos |
| Health check | `/healthz` (configured in `railway.toml`) |
| Service RAM | ≥ 2 GB recommended for runtime |

Push `railway.toml` to GitHub so Railway picks up config-as-code (a dashboard-only deploy won't get these settings).

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for Railway build/deploy failures (OOM, health checks, PORT, DB).

Quick checks:

- **Deploy times out:** increase health check timeout in `railway.toml` (`environments.pr` uses 900s); confirm path is `/healthz` not `/api/health`.
- **502 / not listening:** Grafana must listen on Railway's `PORT` (set `GF_SERVER_HTTP_PORT=${{PORT}}` or rely on `run.sh` PORT mapping).
- **Build exit 137 / OOM:** lower Docker build arg `JS_NODE_MAX_OLD_SPACE=4096` (see TROUBLESHOOTING.md).
- **OAuth redirect mismatch** (if using GitHub login): `GF_SERVER_ROOT_URL` must match the browser URL.
- **Data gone after restart:** attach a volume at `/var/lib/grafana` or use Postgres.
