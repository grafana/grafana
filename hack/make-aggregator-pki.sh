#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

base_dir="${SCRIPT_DIR}/../data/grafana-aggregator"

rm -rf "${base_dir}"
mkdir -p "${base_dir}"

echo "Will create certificates in: ${base_dir}"

openssl req -nodes -new -x509 -keyout "${base_dir}/ca.key" -out "${base_dir}/ca.crt" \
  -subj "/C=US/ST=New Sweden/L=Stockholm /O=Grafana/OU=R&D/CN=test-ca/emailAddress=test@grafana.app" -days 3650
openssl req -out "${base_dir}/client.csr" -new -newkey rsa:4096 -nodes -keyout "${base_dir}/client.key" \
  -subj "/CN=development/O=system:masters" \
  -addext "extendedKeyUsage = clientAuth"
openssl x509 -req -days 3650 -in "${base_dir}/client.csr" -CA "${base_dir}/ca.crt" -CAkey "${base_dir}/ca.key" \
  -set_serial 01 \
  -sha256 -out "${base_dir}/client.crt" \
  -copy_extensions=copyall

openssl req -out "${base_dir}/server.csr" -new -newkey rsa:4096 -nodes -keyout "${base_dir}/server.key" \
  -subj "/CN=localhost/O=aggregated" \
  -addext "subjectAltName = DNS:v0alpha1.example.grafana.app.default.svc,DNS:localhost,DNS:*.default.svc,DNS:*.default.svc.cluster.local" \
  -addext "extendedKeyUsage = serverAuth, clientAuth"
openssl x509 -req -days 3650 -in "${base_dir}/server.csr" -CA "${base_dir}/ca.crt" -CAkey "${base_dir}/ca.key" \
  -set_serial 02 \
  -sha256 -out "${base_dir}/server.crt" \
  -copy_extensions=copyall

# Apply broad permissions to certificates/keys so that containers passing these around for
# tests don't run into permission related errors
chmod 755 "${base_dir}"/*.*
