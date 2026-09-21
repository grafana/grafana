#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
out=${COMPOSE_FIXTURE_DIR:-$root/.local-compose/generated}
mkdir -p "$out/certs" "$out/signer"
umask 077
if [ ! -s "$out/certs/ca.key" ] || [ ! -s "$out/certs/ca.crt" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj '/CN=error-tracking-compose-ca' -keyout "$out/certs/ca.key" -out "$out/certs/ca.crt" >/dev/null 2>&1
fi
for name in api authz; do
  if [ ! -s "$out/certs/$name.key" ] || [ ! -s "$out/certs/$name.crt" ]; then
    openssl req -newkey rsa:2048 -nodes -subj "/CN=$name" -keyout "$out/certs/$name.key" -out "$out/certs/$name.csr" >/dev/null 2>&1
    printf 'subjectAltName=DNS:%s,DNS:%s.default,DNS:%s.default.svc.cluster.local\n' "$name" "$name" "$name" >"$out/certs/$name.ext"
    openssl x509 -req -days 30 -in "$out/certs/$name.csr" -CA "$out/certs/ca.crt" -CAkey "$out/certs/ca.key" -CAserial "$out/certs/ca.srl" -CAcreateserial -extfile "$out/certs/$name.ext" -out "$out/certs/$name.crt" >/dev/null 2>&1
  fi
done
printf '%s' ThisIsMySecretToken >"$out/token"
runtime_password=''
if [ -f "$out/.env" ]; then
  runtime_password=$(sed -n 's/^ERROR_TRACKING_RUNTIME_PASSWORD=//p' "$out/.env" | head -n 1)
fi
if [ -z "$runtime_password" ]; then
  runtime_password=$(openssl rand -hex 24)
fi
printf 'ERROR_TRACKING_RUNTIME_PASSWORD=%s\nERROR_TRACKING_FIXTURE_DIR=%s\n' "$runtime_password" "$out" >"$out/.env"
chmod 600 "$out/.env"
cp "$root/deploy/local-compose/signer-config.yaml" "$out/signer/config.yaml"
cat >"$out/authz.ini" <<'EOF'
target = authz-server
[authz_server]
permission_cache_ttl = 30s
stack_info_cache_ttl = 5s
[database]
ensure_default_org_and_user = false
skip_migrations = true
[grpc_server]
address = 0.0.0.0:10000
cert_file = /etc/error-tracking/certs/authz.crt
cert_key = /etc/error-tracking/certs/authz.key
enabled = true
use_tls = true
[grpc_server_authentication]
signing_keys_url = http://auth-signer:8080/jwks
[legacy_databases]
instrument_queries = false
max_idle_conn = 10
max_open_conn = 50
servers = default=superuser:password@tcp(mysql:3306)/stacks_info?clientFoundRows=true&parseTime=True,hg_grafana_first=superuser:password@tcp(mysql:3306)/hg_grafana_first?clientFoundRows=true&parseTime=True,hg_grafana_second=superuser:password@tcp(mysql:3306)/hg_grafana_second?clientFoundRows=true&parseTime=True
[token_exchange]
token = AuthzServiceToken
token_exchange_url = http://auth-signer:8080/sign/access-token
[server]
protocol = https
http_port = 6443
cert_file = /etc/error-tracking/certs/authz.crt
cert_key = /etc/error-tracking/certs/authz.key
EOF
sed -e 's|auth-signer\.default\.svc\.cluster\.local:6481|auth-signer:8080|g' \
  -e 's|authz-service\.default\.svc\.cluster\.local|authz|g' \
  -e 's|/etc/error-tracking/tls/|/etc/error-tracking/certs/|g' \
  -e 's|/etc/error-tracking/token/|/etc/error-tracking/|g' \
  -e 's|/etc/error-tracking/certs/tls.crt|/etc/error-tracking/certs/api.crt|g' \
  -e 's|/etc/error-tracking/certs/tls.key|/etc/error-tracking/certs/api.key|g' \
  "$root/deploy/local-k8s/error-tracking-api-config.json" >"$out/config.json"
cat >"$out/grafana.ini" <<'EOF'
[server]
http_port = 3000
[security]
admin_password = admin
[environment]
stack_id = 11
[database]
type = mysql
host = mysql:3306
name = hg_grafana_first
user = superuser
password = password
ssl_mode = disable
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
[grafana-apiserver]
dev_mode_enabled = true
remote_services_file = /etc/grafana/apiservices.yaml
aggregator_dev_mode_direct_to_service = true
[feature_toggles]
kubernetesAggregator = true
kubernetesAggregatorCapTokenAuth = true
grafana.rspackBuild = true
aggregation.error-tracking-grafana-app.enabled = true
aggregation.cap-token-auth.obo-signing = ENABLED
[grpc_client_authentication]
token_exchange_url = http://auth-signer:8080/sign/access-token
token = ThisIsMySecretToken
EOF
cat >"$out/apiservices.yaml" <<'EOF'
- group: error-tracking.grafana.app
  version: v0alpha1
  host: api
  port: 6443
EOF
mkdir -p "$out/audit"
cat >"$out/audit/policy.yaml" <<'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    omitStages: [RequestReceived, ResponseStarted, Panic]
EOF
cat >"$out/mysql-init.sql" <<'EOF'
CREATE DATABASE IF NOT EXISTS hg_grafana_first;
CREATE DATABASE IF NOT EXISTS hg_grafana_second;
CREATE DATABASE IF NOT EXISTS hg_grafana_third;
CREATE USER IF NOT EXISTS 'superuser'@'%' IDENTIFIED BY 'password';
CREATE TABLE IF NOT EXISTS stacks_info.instances (id INT AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(255) NOT NULL, stack_id INT NOT NULL, `database` VARCHAR(255) NOT NULL, status INT DEFAULT 0);
INSERT INTO stacks_info.instances (slug, stack_id, `database`, status) VALUES ('grafana_first', 11, 'hg_grafana_first', 1), ('grafana_second', 22, 'hg_grafana_second', 1), ('grafana_third', 1, 'hg_grafana_third', 1);
GRANT ALL PRIVILEGES ON stacks_info.* TO 'superuser'@'%';
GRANT ALL PRIVILEGES ON hg_grafana_first.* TO 'superuser'@'%';
GRANT ALL PRIVILEGES ON hg_grafana_second.* TO 'superuser'@'%';
GRANT ALL PRIVILEGES ON hg_grafana_third.* TO 'superuser'@'%';
FLUSH PRIVILEGES;
EOF
chmod -R a+rX "$out"
chmod 600 "$out/.env"
printf '%s\n' "fixtures written to $out"
