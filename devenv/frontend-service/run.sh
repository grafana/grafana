# Script called from makefile to auto down the tilt environment on ctrl + c.
# Paths are relative to the makefile

function tilt_down()
{
    echo "Tearing down Tilt environment... (this might take a little while)"
    tilt down -f devenv/frontend-service/Tiltfile
}


trap tilt_down SIGINT

tilt up -f devenv/frontend-service/Tiltfile