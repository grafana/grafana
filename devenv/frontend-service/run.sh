# Script called from makefile to auto down the tilt environment on ctrl + c.
# Paths are relative to the makefile

TILT_FILE_ARGS=(-f devenv/frontend-service/Tiltfile)
TILT_ARGS=("${TILT_FILE_ARGS[@]}")

# When PORT is set, derive a unique Tilt UI port so multiple
# instances can run in parallel without conflicting on the default 10350.
if [[ -n "${PORT}" ]]; then
  TILT_PORT=$((PORT + 9))
  TILT_ARGS+=(--port "${TILT_PORT}")
fi

GRAFANA_PORT="${PORT:-3000}"
echo "Grafana will be available at http://localhost:${GRAFANA_PORT} once ready."

function tilt_down()
{
    echo "Tearing down Tilt environment... (this might take a little while)"
    tilt down "${TILT_FILE_ARGS[@]}"
}

# Create placeholder files to prevent docker from creating folders here instead
# when it attempts to mount them into the docker containers
touch devenv/frontend-service/configs/grafana-api.local.ini
touch devenv/frontend-service/configs/frontend-service.local.ini

if [[ "${AUTO_DOWN}" != "false" ]]; then
  trap tilt_down SIGINT
fi

tilt up "${TILT_ARGS[@]}"
