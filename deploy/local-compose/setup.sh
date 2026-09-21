#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
out=${COMPOSE_FIXTURE_DIR:-$root/.local-compose/generated}
if [ "$(id -u)" -ne 0 ]; then
  echo 'fixture setup must run as root inside the Compose initializer' >&2
  exit 1
fi
mkdir -p "$out/certs"
mkdir -p "$out/provisioning/plugins"
umask 077
renew_ca=0
if [ ! -s "$out/certs/ca.key" ] || [ ! -s "$out/certs/ca.crt" ] || ! openssl x509 -checkend 86400 -noout -in "$out/certs/ca.crt" >/dev/null 2>&1; then
  rm -f "$out/certs/ca.key" "$out/certs/ca.crt" "$out/certs/ca.srl"
  renew_ca=1
fi
if [ "$renew_ca" = 1 ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj '/CN=error-tracking-compose-ca' -keyout "$out/certs/ca.key" -out "$out/certs/ca.crt" >/dev/null 2>&1
fi
for name in api; do
  if [ ! -s "$out/certs/$name.key" ] || [ ! -s "$out/certs/$name.crt" ] || [ "$renew_ca" = 1 ] || ! openssl x509 -checkend 86400 -noout -in "$out/certs/$name.crt" >/dev/null 2>&1; then
    rm -f "$out/certs/$name.key" "$out/certs/$name.crt" "$out/certs/$name.csr" "$out/certs/$name.ext"
    openssl req -newkey rsa:2048 -nodes -subj "/CN=$name" -keyout "$out/certs/$name.key" -out "$out/certs/$name.csr" >/dev/null 2>&1
    printf 'subjectAltName=DNS:%s,DNS:%s.default,DNS:%s.default.svc.cluster.local\n' "$name" "$name" "$name" >"$out/certs/$name.ext"
    openssl x509 -req -days 30 -in "$out/certs/$name.csr" -CA "$out/certs/ca.crt" -CAkey "$out/certs/ca.key" -CAserial "$out/certs/ca.srl" -CAcreateserial -extfile "$out/certs/$name.ext" -out "$out/certs/$name.crt" >/dev/null 2>&1
  fi
done
runtime_password=''
if [ -s "$out/runtime-password" ]; then
  runtime_password=$(cat "$out/runtime-password")
fi
if [ -z "$runtime_password" ]; then
  runtime_password=$(openssl rand -hex 24)
fi
printf '%s' "$runtime_password" >"$out/runtime-password"
chmod 600 "$out/runtime-password"
cat >"$out/apiservices.yaml" <<'EOF'
- group: error-tracking.grafana.app
  version: v0alpha1
  host: api
  port: 6443
EOF
sed -e 's|auth-signer\.default\.svc\.cluster\.local:6481|auth-signer:8080|g' \
  -e 's|/etc/error-tracking/tls/|/etc/error-tracking/certs/|g' \
  -e 's|/etc/error-tracking/certs/tls.crt|/etc/error-tracking/certs/api.crt|g' \
  -e 's|/etc/error-tracking/certs/tls.key|/etc/error-tracking/certs/api.key|g' \
  "$root/deploy/local-k8s/error-tracking-api-config.json" >"$out/config.json"
cat >"$out/grafana.ini" <<'EOF'
[server]
http_port = 3000
[security]
admin_password = admin
[grafana-apiserver]
remote_services_file = /etc/grafana/apiservices.yaml
aggregator_dev_mode_direct_to_service = true
[grpc_client_authentication]
token = ThisIsMySecretToken
token_exchange_url = http://auth-signer:8080/sign/access-token
[plugins]
allow_loading_unsigned_plugins = grafana-errortracking-app
preinstall_disabled = true
preinstall_auto_update = false
[environment]
stack_id = 11
[feature_toggles]
kubernetesAggregator = true
kubernetesAggregatorCapTokenAuth = true
aggregation.error-tracking-grafana-app.enabled = true
aggregation.cap-token-auth.obo-signing = ENABLED
[feature_toggles.openfeature]
provider = static
enable_api = true
[auth.extended_jwt]
enabled = true
expect_claims = false
jwks_url = http://auth-signer:8080/jwks
[id_forwarding]
token = ThisIsMySecretToken
sign_url = http://auth-signer:8080/sign/id-token
EOF
cat >"$out/provisioning/plugins/error-tracking.yaml" <<'EOF'
apiVersion: 1
apps:
  - type: grafana-errortracking-app
    org_id: 1
    disabled: false
EOF
mkdir -p "$out/audit"
cat >"$out/audit/policy.yaml" <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    omitStages: [RequestReceived, ResponseStarted, Panic]
EOF
find "$out" -type d -exec chmod 755 {} +
find "$out" -type f -exec chmod 644 {} +
chmod 600 "$out/certs/ca.key"
chown 100:101 "$out/runtime-password" "$out/certs/api.key"
chmod 440 "$out/runtime-password" "$out/certs/api.key"
printf '%s\n' "fixtures written to $out"
