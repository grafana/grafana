#!/usr/bin/env bash
# Start a local Grafana dev instance (backend + frontend) in tmux sessions.
# Usage: scripts/start-local.sh [--backend-only] [--frontend-only] [--no-install]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# Skill lives at .claude/skills/run-grafana/scripts → repo root is 4 levels up
# scripts → run-grafana → skills → .claude → repo root
cd "$ROOT"

BACKEND_ONLY=0
FRONTEND_ONLY=0
NO_INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    --no-install) NO_INSTALL=1 ;;
    -h|--help)
      echo "Usage: $0 [--backend-only] [--frontend-only] [--no-install]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

TMUX_BIN="${TMUX_BIN:-tmux}"
TMUX_CONF=""
if [[ -f /exec-daemon/tmux.portal.conf ]]; then
  TMUX_CONF="-f /exec-daemon/tmux.portal.conf"
fi

tmux_has() {
  # shellcheck disable=SC2086
  $TMUX_BIN $TMUX_CONF has-session -t "=$1" 2>/dev/null
}

tmux_new() {
  local name="$1"
  shift
  # shellcheck disable=SC2086
  $TMUX_BIN $TMUX_CONF new-session -d -s "$name" -c "$ROOT" -- "$@"
}

ensure_frontend_deps() {
  if [[ "$NO_INSTALL" -eq 1 ]]; then
    return 0
  fi
  if [[ ! -d node_modules ]]; then
    echo "→ Installing frontend dependencies (yarn install --immutable)…"
    # Login shell picks up nvm-pinned Node when PATH is polluted by infra injects.
    bash -lc 'corepack enable >/dev/null 2>&1 || true; yarn install --immutable'
  else
    echo "→ node_modules present; skipping yarn install"
  fi
}

start_backend() {
  if tmux_has grafana-backend; then
    echo "→ Backend already running (tmux session grafana-backend)"
    return 0
  fi
  echo "→ Starting backend (make run) in tmux session grafana-backend…"
  tmux_new grafana-backend bash -lc 'make run'
}

start_frontend() {
  if tmux_has grafana-frontend; then
    echo "→ Frontend already running (tmux session grafana-frontend)"
    return 0
  fi
  echo "→ Starting frontend (yarn start) in tmux session grafana-frontend…"
  # Login shell for pinned Node / yarn via corepack + nvm.
  tmux_new grafana-frontend bash -lc 'yarn start'
}

wait_ready() {
  local url="http://127.0.0.1:3000/api/health"
  local tries=90
  echo "→ Waiting for $url (up to ~${tries}s; first backend compile can take several minutes)…"
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "→ Health check OK"
      return 0
    fi
    sleep 1
  done
  echo "⚠ Timed out waiting for health. Backend may still be compiling — check: tmux attach -t grafana-backend" >&2
  return 1
}

echo "Grafana local start (repo: $ROOT)"

if [[ "$FRONTEND_ONLY" -eq 0 ]]; then
  start_backend
fi

if [[ "$BACKEND_ONLY" -eq 0 ]]; then
  ensure_frontend_deps
  start_frontend
fi

if [[ "$FRONTEND_ONLY" -eq 0 ]]; then
  wait_ready || true
fi

cat <<EOF

Local Grafana
  URL:      http://localhost:3000/
  Login:    admin / admin
  Backend:  tmux session grafana-backend   (make run)
  Frontend: tmux session grafana-frontend  (yarn start)

Useful:
  tmux attach -t grafana-backend
  tmux attach -t grafana-frontend
  $(dirname "$0")/stop-local.sh
EOF
