#!/usr/bin/env bash
# Stop local Grafana tmux sessions started by start-local.sh.
set -euo pipefail

TMUX_BIN="${TMUX_BIN:-tmux}"
TMUX_CONF=""
if [[ -f /exec-daemon/tmux.portal.conf ]]; then
  TMUX_CONF="-f /exec-daemon/tmux.portal.conf"
fi

stop_session() {
  local name="$1"
  # shellcheck disable=SC2086
  if $TMUX_BIN $TMUX_CONF has-session -t "=$name" 2>/dev/null; then
    # shellcheck disable=SC2086
    $TMUX_BIN $TMUX_CONF kill-session -t "=$name"
    echo "→ Stopped $name"
  else
    echo "→ Session $name not running"
  fi
}

stop_session grafana-backend
stop_session grafana-frontend
echo "Done."
