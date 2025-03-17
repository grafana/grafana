#!/bin/bash
set -e

# Load environment variables
if [ -f scripts/iam/.env ]; then
    export $(cat scripts/iam/.env | xargs)
fi

# Generate config from template
envsubst < scripts/iam/custom-iam-template.ini > scripts/iam/custom.ini

# Launch the service
./bin/grafana server \
    --config=scripts/iam/custom.ini \
    --target=iam.grafana.app