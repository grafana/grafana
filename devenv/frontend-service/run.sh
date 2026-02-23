# Script called from makefile to auto down the tilt environment on ctrl + c.
# Paths are relative to the makefile

function tilt_down()
{
    echo "Tearing down Tilt environment... (this might take a little while)"
    tilt down -f devenv/frontend-service/Tiltfile
}

# Create placeholder files to prevent docker from creating folders here instead
# when it attempts to mount them into the docker containers
touch devenv/frontend-service/configs/grafana-api.local.ini
touch devenv/frontend-service/configs/frontend-service.local.ini

if [[ "${AUTO_DOWN}" != "false" ]]; then
  trap tilt_down SIGINT
fi

tilt up -f devenv/frontend-service/Tiltfile
