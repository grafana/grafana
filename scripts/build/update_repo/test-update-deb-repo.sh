#!/usr/bin/env bash

# Usage
# docker run -ti --rm -u 0:0 grafana/grafana-ci-deploy:1.1.0 bash
# in the container:
# mkdir -p /go/src/github.com/grafana/dist
# cd /go/src/github.com/grafana
#
# outside of container:
# cd <grafana project dir>/..
# docker cp grafana <container_name>:/go/src/github.com/grafana/.
# docker cp <gpg.key used for signing> <container_name>:/private.key
#
# in container:
# gpg --batch --allow-secret-key-import --import /private.key
# cd dist && wget https://dl.grafana.com/oss/release/grafana_5.4.3_amd64.deb && cd ..
# run this script:
# ./script/build/update_repo/test-update-deb-repo.sh <gpg key password>

GPG_PASS=${1:-}

./scripts/build/update_repo/update-deb.sh "oss" "$GPG_PASS" "v5.4.3" "dist" "grafana-testing-aptly-db" "grafana-testing-repo"
