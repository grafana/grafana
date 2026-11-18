# One backend, many frontends

Run several frontend branches side by side against one shared backend.
Each worktree gets its own hostname (`<name>.localhost`), so logins and cookies are separate.
The name is the worktree directory name (`grafana` is `main`; a `grafana-` prefix is dropped).

## Workflow

1. In the worktree that should run the backend:

   ```bash
   mise run worktree:backend
   ```

   Only one worktree runs the backend at a time. Stop it and run `mise run worktree:down` there before moving it.

2. In every worktree whose frontend you want to test, including the backend worktree if you want to open its own hostname:

   ```bash
   mise run worktree:frontend
   ```

   The first run registers the worktree and starts the shared Traefik container. No setup step is needed.

3. Open `http://<name>.localhost` for each worktree.

`mise run worktree:status` lists every registered worktree, what it routes to and whether those targets are listening.
The Traefik dashboard is at <http://traefik.localhost>.

`worktree:frontend` fails with a clear message if no backend is registered yet, or if more than one worktree claims to run it.
`mise run worktree:down` removes the current worktree's routes and registry entry.

Plain `make run` / `pnpm start` are unchanged.

## How it works

- State lives under `~/.grafana-worktrees` (override with `GRAFANA_WORKTREES_HOME`): a registry entry and a Traefik route file per worktree.
- A shared Traefik container (`grafana-worktree-traefik`, port 80) routes `/public` and `/ws` to the worktree's own frontend
  and everything else to the backend, and sets `X-Grafana-Frontend` so the backend renders the right bundle.
- The backend honours that header only in development mode and only for `http://<name>.localhost`
  (`[frontend_dev] worktree_server_url_template`). `worktree:backend` enables it.
- Each worktree gets its own frontend port from a hashed block; `main` keeps 3333 and the usual backend ports.

## Limits

- Requires Docker, port 80, and `*.localhost` resolving to loopback (add hosts entries if yours doesn't).
- The backend worktree needs built `dist/` folders for the `graphite` and `grafana-testdata-datasource` plugins, or the backend fails
  at startup. Copy them from another worktree if the plugin build doesn't work.
- You are responsible for the frontends being compatible with the backend.
- On Linux the proxy reaches host processes through `host.docker.internal`; services bound only to `127.0.0.1` may be unreachable.
- Not an authentication boundary; for trusted dev machines only.
