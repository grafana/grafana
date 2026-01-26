---
name: start-dev-server
description: Run commands to start Grafana local dev after initial setup. Use when the user asks how to start the dev server, run Grafana locally, or run frontend/backend watchers.
---

# Start dev server

## Instructions
When asked how to start the dev server after initial setup, run the commands below using the Shell tool. Do not ask the user to run them.

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
- After both are running, open the `@Browser` in Cursor at `http://localhost:3000/`.
