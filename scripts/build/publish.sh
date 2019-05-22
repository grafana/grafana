#!/bin/sh

# no relation to publish.go

EXTRA_OPTS="$@"

# Right now we hack this in into the publish script.
# Eventually we might want to keep a list of all previous releases somewhere.
_releaseNoteUrl="https://community.grafana.com/t/release-notes-v6-2-x/17037"
_whatsNewUrl="https://grafana.com/docs/guides/whats-new-in-v6-2/"

./scripts/build/release_publisher/release_publisher \
    --wn ${_whatsNewUrl} \
    --rn ${_releaseNoteUrl} \
    --version ${CIRCLE_TAG} \
    --apikey  ${GRAFANA_COM_API_KEY} ${EXTRA_OPTS}
