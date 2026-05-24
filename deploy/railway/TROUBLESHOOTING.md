# Railway troubleshooting (fieldsphere/grafana)

## I can't see your Railway logs from the repo

To debug a specific failure, grab **Build Logs** and **Deploy Logs** from Railway → Service → Deployments → (failed deploy) → View logs, or run:

```bash
npx @railway/cli login
npx @railway/cli link
npx @railway/cli logs
```

Paste the last ~50 lines of a failed build or deploy when asking for help.

## Common failures

### 1. Build killed with exit code 137 (OOM)

**Symptom:** Build stops during `yarn install` or `yarn build` in the Docker `js-builder` stage.

**Cause:** The Dockerfile defaults to `NODE_OPTIONS=--max_old_space_size=8000` (8 GB heap). Railway's build VM has a smaller memory cap than a local machine.

**Fix:**

1. Railway → Service → **Settings** → Docker → **Build arguments** (or Variables used at build time):
   - `JS_NODE_MAX_OLD_SPACE=4096` (try `6144` if still OOM)
2. Redeploy.

If it still fails, use a larger Railway plan or build the image in GitHub Actions, push to GHCR, and deploy that image (advanced).

### 2. Deploy / health check timeout

**Symptom:** Build succeeds; deploy runs for minutes then fails "health check" or "service unavailable".

**Causes:**

| Cause | Fix |
|-------|-----|
| Health check hits `/api/health` before DB is ready | Use `/healthz` in `railway.toml` (committed config) |
| Cold Docker build + DB migrations exceed timeout | Raise `healthcheckTimeout` in `railway.toml` (600–900s) |
| Grafana listens on 3000, Railway routes to `$PORT` | Set `GF_SERVER_HTTP_PORT=${{PORT}}` or use updated `packaging/docker/run.sh` (maps `PORT` automatically) |
| First image build still running | Wait; full Grafana image builds often take 20–45+ minutes |

### 3. Running but 502 Bad Gateway

**Symptom:** Deploy shows "Active" briefly, browser returns 502.

**Fix:** Confirm **Deploy logs** show `HTTP Server Listen` on the same port Railway assigns. Check variables:

- `GF_SERVER_HTTP_PORT` must equal Railway's `PORT` (or unset so `run.sh` sets it from `PORT`).

### 4. Crash loop after start (database)

**Symptom:** Container restarts; logs mention database, migrations, or permission errors.

**Fix:**

- **SQLite:** Mount a Railway **volume** at `/var/lib/grafana`.
- **Postgres:** Set all `GF_DATABASE_*` variables from the Railway Postgres plugin references; `GF_DATABASE_SSL_MODE=require` is usually required.

### 5. `GF_SERVER_ROOT_URL` placeholder

**Symptom:** Redirect loops, broken assets, or login failures.

**Fix:** Set `GF_SERVER_ROOT_URL` to the exact public URL Railway gives you (HTTPS, no trailing slash). For PR previews use `https://${{RAILWAY_PUBLIC_DOMAIN}}` in that environment's variables.

### 6. Config in repo not applied

**Symptom:** Health check still uses `/api/health` or short timeout despite local `railway.toml`.

**Cause:** `railway.toml` was never pushed to the branch Railway builds.

**Fix:** Commit and push `railway.toml` to `fieldsphere/grafana`, or mirror the same settings in the Railway dashboard.

## Checklist before opening an issue

- [ ] `railway.toml` pushed to the deployed branch
- [ ] `GF_SECURITY_ADMIN_PASSWORD` set (not empty)
- [ ] `GF_SERVER_ROOT_URL` matches the live URL
- [ ] Service RAM ≥ 1 GB (2 GB safer)
- [ ] Volume at `/var/lib/grafana` if using SQLite
- [ ] Build logs saved if OOM (exit 137)
