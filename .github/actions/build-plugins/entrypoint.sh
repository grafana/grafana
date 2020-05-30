#/bin/bash
set -xeo pipefail

chmod +x grabpl
# TODO: Parameterize edition
./grabpl build-plugins --edition oss --sign --signing-admin
