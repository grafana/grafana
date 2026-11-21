# One backend, many frontends

Run several frontend branches side by side against one shared backend.
Each worktree gets its own hostname (`<name>.localhost`), so logins and cookies are separate.
The name is the worktree directory name (`grafana` is `main`; a `grafana-` prefix is dropped).

## Before you start

- Docker with the Compose v2 plugin is running, and port 80 is free.
- In each worktree you use, run `mise trust` once. mise refuses to read `mise.toml` in a directory it has not been told to trust
  ("Config files … are not trusted"), and every new worktree is a new directory.
- In each worktree, run `pnpm install --frozen-lockfile`. The tooling imports `js-yaml` and `worktree:frontend` runs `pnpm start`.

There is no separate setup task: `worktree:frontend` and `worktree:backend` register the worktree and start Traefik the first time you run them.

## Workflow

1. In the main checkout (`grafana`), run the backend:

   ```bash
   mise run worktree:backend
   ```

   The backend always runs from the main checkout; the task refuses to run anywhere else. It is a plain `make run` with the worktree settings added,
   so it uses that checkout's existing `data/` and `conf/custom.ini` and keeps your dashboards, users and teams. It listens on port 3000.

2. In every worktree whose frontend you want to test, including the main checkout if you want to open its own hostname:

   ```bash
   mise run worktree:frontend
   ```

   The first run registers the worktree and starts the shared Traefik container.

3. Open `http://<name>.localhost` for each worktree, or use the dashboard below to find them.

## Dashboard

`mise run worktree:dashboard` serves a list of the registered worktrees at <http://worktrees.localhost>, one card per worktree with a link that opens its frontend.
It keeps running until you stop it, so start it in its own terminal. Open <http://traefik.localhost> for Traefik's own dashboard.

Each card shows the branch, whether that frontend is listening, and a description of the change: the text from `mise run worktree:frontend --description "…"` if you passed one,
otherwise the subjects of the branch's commits that are not on `origin/main` yet. The page refreshes every few seconds.

The server listens on `127.0.0.1:3399` and only answers its own host names. Its files live in `scripts/worktree/dashboard/`:
static `index.html`, `dashboard.css` and `dashboard.js`, plus a JSON endpoint at `/api/worktrees` that the page reads.

`mise run worktree:status` shows whether the backend is up and lists every registered worktree with its frontend port.

`mise run worktree:down` removes the current worktree's routes and registry entry.

Plain `make run` / `pnpm start` are unchanged.

## How it works

- State lives under `~/.grafana-worktrees` (override with `GRAFANA_WORKTREES_HOME`): a registry entry and a Traefik route file per worktree.
- A shared Traefik container (`grafana-worktree-traefik`, port 80, defined in `docker-compose.yaml` next to this file) routes `/public` and `/ws` to the worktree's own frontend
  and everything else to the backend, and sets `X-Grafana-Frontend` so the backend renders the right bundle.
- The backend honours that header only in development mode and only for `http://<name>.localhost`
  (`[frontend_dev] worktree_server_url_template`). `worktree:backend` enables it.
- Each worktree gets its own frontend port, picked from its name; `main` keeps 3333 for the frontend and 3000 for the backend.

## Limits

- Requires Docker with the Compose v2 plugin, port 80, and `*.localhost` resolving to loopback (add hosts entries if yours doesn't).
- The main checkout needs built `dist/` folders for the `graphite` and `grafana-testdata-datasource` plugins, or the backend fails
  at startup. Copy them from another worktree if the plugin build doesn't work.
- Enterprise is not handled. `make enterprise-dev` overlays enterprise code onto one OSS checkout (the main one by default), so an
  enterprise backend has to run from the main checkout. Worktree frontends are OSS-only, so enterprise-only pages will not appear in them.
  Overlaying enterprise onto a worktree (`GRAFANA_DIR` in `grafana-enterprise`) is untested here.
- You are responsible for the frontends being compatible with the backend.
- On Linux the proxy reaches host processes through `host.docker.internal`; services bound only to `127.0.0.1` may be unreachable.
- Not an authentication boundary; for trusted dev machines only.
