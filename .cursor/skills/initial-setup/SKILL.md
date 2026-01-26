---
name: initial-setup
description: Run initial local development setup commands for this Grafana repo, focusing on frontend dependency install/build and backend build/run. Use when the user asks about local dev setup, initial setup, frontend build, backend build, or how to run Grafana locally.
---

# Initial setup

## Instructions
When the user asks how to set up or run the repo locally, run the commands below using the Shell tool. Do not ask the user to run them.

### Frontend setup and build
Run from the repo root:

```sh
corepack enable
corepack install
yarn install --immutable
yarn start
```

### Backend build and run
Run from the repo root:

```sh
make run
```

## Notes
- Keep the response limited to these commands unless the user asks for dependencies or troubleshooting.
- After both servers are running, open the `@Browser` in Cursor at `http://localhost:3000/`. This is required, not optional.
- If the user asks for prerequisites, point to `contribute/developer-guide.md` and mention Go and Node.js LTS with Corepack enabled.
