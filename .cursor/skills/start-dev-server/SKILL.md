---
name: start-dev-server
description: Run commands to start Grafana local dev after initial setup. Use when the user asks how to start the dev server, run Grafana locally, or run frontend/backend watchers.
---

# Start dev server

## Instructions
When asked how to start the dev server after initial setup, run the commands below using the Shell tool. Do not ask the user to run them.

### Preflight
Before starting new processes, check if they are already running by inspecting the terminals folder. If `yarn start` fails with a missing `node_modules` state file (or no `node_modules` is present), run the frontend dependency install in this order:

```sh
corepack enable
corepack install
yarn install --immutable
```

### Backend server
Run from the repo root:

```sh
make run
```

### Frontend assets watcher
Run from the repo root:

```sh
yarn start
```

## Notes
- Run both commands in separate terminals for full local dev.
- If port `3000` is already in use, stop the existing process and restart both servers.
- Wait for readiness: backend should log `HTTP Server Listen`, frontend should log `Compiled successfully` (and finish type-checking) before opening the browser.
- After both are ready, run `curl -I http://localhost:3000/` as a quick check. If it doesn't return `HTTP/1.1 302` to `/login`, diagnose the backend and retry the check before moving on.
- `http://localhost:3000/` redirects to `/login`, so `http://localhost:3000/login` is a good smoke check.
- If the embedded `@Browser` shows `chrome-error://chromewebdata/` or won't load, open `http://localhost:3000/login` in the local system browser instead.
