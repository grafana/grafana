#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
enterprise_source=${ENTERPRISE_SOURCE:-/Users/inanc/grafana/grafana-enterprise-error-tracking}
platform_image=${PLATFORM_IMAGE:-error-tracking-platform:local}
api_image=${API_IMAGE:-error-tracking-api:local}
signer_image=${SIGNER_IMAGE:-error-tracking-auth-signer:local}
mysql_image=${MYSQL_IMAGE:-mysql:8.0}
load_images=${LOAD_IMAGES:-1}
cluster_name=${NATIVE_CLUSTER_NAME:-error-tracking-native}
context=kind-$cluster_name
kubeconfig=${KUBECONFIG:-/tmp/$cluster_name.kubeconfig}
namespace=error-tracking
kind_bin=${KIND_BIN:-/Users/inanc/grafana/.local-bin/kind}
kubectl_bin=${KUBECTL_BIN:-kubectl}
python_bin=${PYTHON_BIN:-/opt/homebrew/bin/python3.13}
evidence=${EVIDENCE_FILE:-/tmp/$cluster_name-evidence.txt}
docker_network=${NATIVE_DOCKER_NETWORK:-}
pod_subnet=${NATIVE_POD_SUBNET:-}
service_subnet=${NATIVE_SERVICE_SUBNET:-}
scratch=$(mktemp -d "${TMPDIR:-/tmp}/error-tracking-native.XXXXXX")
forward_pids=
api_scaled_down=0
postgres_scaled_down=0
api_replicas=${API_REPLICAS:-2}
completed=0

cleanup() {
  if [ "$api_scaled_down" = 1 ]; then
    kubectl_local scale deployment/error-tracking-apiserver --replicas="$api_replicas" >/dev/null 2>&1 || true
  fi
  if [ "$postgres_scaled_down" = 1 ]; then
    kubectl_local scale statefulset/error-tracking-postgres --replicas=1 >/dev/null 2>&1 || true
  fi
  for pid in $forward_pids; do kill "$pid" 2>/dev/null || true; done
  if [ "$completed" != 1 ]; then
    for log in "$scratch"/port-forward-*.log; do
      [ -f "$log" ] || continue
      printf '\n== %s ==\n' "$(basename "$log")" >>"/tmp/$cluster_name-port-forwards.log"
      cat "$log" >>"/tmp/$cluster_name-port-forwards.log"
    done
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT INT TERM

case "$context" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local context: $context" >&2; exit 1 ;;
esac

kubectl_local() {
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n "$namespace" "$@"
}

kubectl_default() {
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default "$@"
}

record() {
  printf '%s\n' "$1" | tee -a "$evidence"
}

wait_http() {
  url=$1
  i=0
  until curl --connect-timeout 2 --max-time 5 -fsS "$url" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 90 ]; then
      echo "timed out waiting for $url" >&2
      exit 1
    fi
    sleep 2
  done
}

wait_https_insecure() {
  url=$1
  i=0
  until curl --connect-timeout 2 --max-time 5 -kfsS "$url" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 90 ]; then
      echo "timed out waiting for $url" >&2
      exit 1
    fi
    sleep 2
  done
}

wait_authenticated_events() {
  cookie=$1
  url=$2
  attempt=0
  while :; do
    status=$(curl --connect-timeout 2 --max-time 10 -sS -o "$scratch/events-readiness.json" -w '%{http_code}' \
      -b "$cookie" "$url" || true)
    case "$status" in
      200) return ;;
      000|502|503|504) ;;
      *) echo "event GET returned non-transient HTTP $status" >&2; return 1 ;;
    esac
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 60 ]; then
      {
        kubectl_local logs deployment/st-grafana-11 --since=5m
        kubectl_local logs -l app=error-tracking-apiserver --all-containers=true --prefix=true --since=5m
        "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default logs deployment/authz-service --since=5m
        "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default logs deployment/auth-signer --since=5m
      } >"/tmp/$cluster_name-auth-readiness.log" 2>&1 || true
      echo "timed out waiting for authenticated event route: $url" >&2
      return 1
    fi
    sleep 2
  done
}

start_forward() {
  forward_namespace=$1
  resource=$2
  ports=$3
  attempt=0
  while [ "$attempt" -lt 3 ]; do
    attempt=$((attempt + 1))
    "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n "$forward_namespace" \
      port-forward "$resource" "$ports" >"$scratch/port-forward-$forward_namespace-$(printf '%s' "$resource" | tr / -).log" 2>&1 &
    pid=$!
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      last_forward_pid=$pid
      forward_pids="$forward_pids $pid"
      return
    fi
  done
  echo "failed to port-forward $forward_namespace/$resource $ports" >&2
  exit 1
}

mint_token() {
  stack=$1
  audience=$2
  response=$(curl -fsS -H 'Authorization: Bearer ThisIsMySecretToken' -H 'Content-Type: application/json' \
    --data "{\"namespace\":\"stacks-$stack\",\"audiences\":[\"$audience\"],\"subject\":{\"sub\":\"user:1\",\"identifier\":\"1\",\"type\":\"user\",\"namespace\":\"stacks-$stack\",\"authenticatedBy\":\"password\",\"username\":\"admin\",\"role\":\"Admin\"}}" \
    http://127.0.0.1:6481/sign/access-token)
  printf '%s' "$response" | "$python_bin" -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])'
}

: >"$evidence"
: >"/tmp/$cluster_name-port-forwards.log"
docker image inspect "$platform_image" >/dev/null
docker image inspect "$api_image" >/dev/null
docker image inspect "$signer_image" >/dev/null
docker image inspect "$mysql_image" >/dev/null 2>&1 || docker pull "$mysql_image" >/dev/null
case "$load_images" in 0|1) ;; *) echo 'LOAD_IMAGES must be 0 or 1' >&2; exit 1 ;; esac
case "$api_replicas" in
  ''|*[!0-9]*) echo 'API_REPLICAS must be an integer of at least 2' >&2; exit 1 ;;
esac
[ "$api_replicas" -ge 2 ] || { echo 'API_REPLICAS must be at least 2' >&2; exit 1; }

if ! "$kind_bin" get clusters | grep -qx "$cluster_name"; then
  if [ -n "$docker_network" ]; then
    [ -n "$pod_subnet" ] && [ -n "$service_subnet" ] || {
      echo 'NATIVE_POD_SUBNET and NATIVE_SERVICE_SUBNET are required with NATIVE_DOCKER_NETWORK' >&2
      exit 1
    }
    docker network inspect "$docker_network" >/dev/null 2>&1 || docker network create "$docker_network" >/dev/null
    cat >"$scratch/kind.yaml" <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  podSubnet: "$pod_subnet"
  serviceSubnet: "$service_subnet"
EOF
    KIND_EXPERIMENTAL_DOCKER_NETWORK="$docker_network" \
      "$kind_bin" create cluster --name "$cluster_name" --kubeconfig "$kubeconfig" --config "$scratch/kind.yaml" >/dev/null
  else
    "$kind_bin" create cluster --name "$cluster_name" --kubeconfig "$kubeconfig" >/dev/null
  fi
fi
"$kind_bin" export kubeconfig --name "$cluster_name" --kubeconfig "$kubeconfig" >/dev/null
if [ -n "$docker_network" ]; then
  node_networks=$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' "$cluster_name-control-plane")
  case " $node_networks " in
    *" $docker_network "*) ;;
    *) echo "kind node is not attached to $docker_network" >&2; exit 1 ;;
  esac
fi
if [ "$load_images" = 1 ]; then
  "$kind_bin" load docker-image --name "$cluster_name" "$platform_image" >/dev/null
  "$kind_bin" load docker-image --name "$cluster_name" "$api_image" >/dev/null
  "$kind_bin" load docker-image --name "$cluster_name" "$signer_image" >/dev/null
  docker image save --platform=linux/arm64 "$mysql_image" \
    | docker exec --privileged -i "$cluster_name-control-plane" \
        ctr --namespace=k8s.io images import --all-platforms --digests --snapshotter=overlayfs - >/dev/null
fi

"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" apply -f "$root/deploy/local-k8s/postgres.yaml" >/dev/null
KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" API_IMAGE="$api_image" "$root/deploy/local-k8s/run-migration.sh" >/dev/null

openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj '/CN=error-tracking-local-ca' \
  -keyout "$scratch/ca.key" -out "$scratch/ca.crt" >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -subj '/CN=error-tracking-apiserver.error-tracking.svc.cluster.local' \
  -keyout "$scratch/tls.key" -out "$scratch/tls.csr" >/dev/null 2>&1
printf '%s\n' 'subjectAltName=DNS:error-tracking-apiserver.error-tracking.svc.cluster.local,DNS:error-tracking-apiserver.error-tracking.svc,DNS:error-tracking-apiserver' >"$scratch/tls.ext"
openssl x509 -req -days 30 -in "$scratch/tls.csr" -CA "$scratch/ca.crt" -CAkey "$scratch/ca.key" -CAcreateserial \
  -extfile "$scratch/tls.ext" -out "$scratch/tls.crt" >/dev/null 2>&1
kubectl_local create secret generic error-tracking-apiserver-tls \
  --from-file=tls.crt="$scratch/tls.crt" --from-file=tls.key="$scratch/tls.key" --from-file=ca.crt="$scratch/ca.crt" \
  --dry-run=client -o yaml | kubectl_local apply -f - >/dev/null

openssl req -newkey rsa:2048 -nodes -subj '/CN=authz-service.default.svc.cluster.local' \
  -keyout "$scratch/authz.key" -out "$scratch/authz.csr" >/dev/null 2>&1
printf '%s\n' 'subjectAltName=DNS:authz-service.default.svc.cluster.local,DNS:authz-service.default.svc,DNS:authz-service' >"$scratch/authz.ext"
openssl x509 -req -days 30 -in "$scratch/authz.csr" -CA "$scratch/ca.crt" -CAkey "$scratch/ca.key" -CAcreateserial \
  -extfile "$scratch/authz.ext" -out "$scratch/authz.crt" >/dev/null 2>&1
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default create secret generic error-tracking-authz-tls \
  --from-file=server.crt="$scratch/authz.crt" --from-file=server.key="$scratch/authz.key" --from-file=ca.crt="$scratch/ca.crt" \
  --dry-run=client -o yaml | "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default apply -f - >/dev/null
kubectl_local create secret generic error-tracking-token-exchange \
  --from-literal=token=ThisIsMySecretToken --dry-run=client -o yaml | kubectl_local apply -f - >/dev/null
kubectl_local create configmap error-tracking-api-config \
  --from-file=config.json="$root/deploy/local-k8s/error-tracking-api-config.json" \
  --dry-run=client -o yaml | kubectl_local apply -f - >/dev/null
if ! "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default \
    get secret error-tracking-auth-signer-keys >/dev/null 2>&1; then
  openssl ecparam -name prime256v1 -genkey -noout -out "$scratch/ec_private_key.pem"
  chmod 600 "$scratch/ec_private_key.pem"
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default create secret generic error-tracking-auth-signer-keys \
    --from-file=ec_private_key.pem="$scratch/ec_private_key.pem" >/dev/null
fi
signer_key_hash_before=$("$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default \
  get secret error-tracking-auth-signer-keys -o json | "$python_bin" -c \
  'import base64,hashlib,json,sys; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)["data"]["ec_private_key.pem"])).hexdigest())')

"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default create configmap error-tracking-auth-signer \
  --from-file=config.yaml="$root/deploy/local-compose/signer-config.yaml" --dry-run=client -o yaml \
  | "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default apply -f - >/dev/null
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" apply \
  -f "$enterprise_source/src/devenv/mt-tilt/k8s/mt-db.yaml" >/dev/null
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default rollout status deployment/mt-db --timeout=300s >/dev/null
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" apply -f - >/dev/null <<EOF
apiVersion: apps/v1
kind: Deployment
metadata: {name: auth-signer, namespace: default}
spec:
  replicas: 1
  selector: {matchLabels: {app: auth-signer}}
  template:
    metadata: {labels: {app: auth-signer}}
    spec:
      containers:
        - name: auth-signer
          image: $signer_image
          imagePullPolicy: Never
          command: [/app/main]
          args: [-config, /app/data/config.yaml]
          ports: [{name: http, containerPort: 8080}]
          volumeMounts:
            - {name: config, mountPath: /app/data/config.yaml, subPath: config.yaml, readOnly: true}
            - {name: keys, mountPath: /app/data/keys}
      volumes:
        - name: config
          configMap: {name: error-tracking-auth-signer}
        - name: keys
          secret: {secretName: error-tracking-auth-signer-keys}
---
apiVersion: v1
kind: Service
metadata: {name: auth-signer, namespace: default}
spec:
  selector: {app: auth-signer}
  ports: [{name: http, port: 6481, targetPort: http}]
EOF
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default rollout restart deployment/auth-signer >/dev/null
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default rollout status deployment/auth-signer --timeout=180s >/dev/null
signer_key_hash_after=$("$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default \
  get secret error-tracking-auth-signer-keys -o json | "$python_bin" -c \
  'import base64,hashlib,json,sys; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)["data"]["ec_private_key.pem"])).hexdigest())')
[ "$signer_key_hash_after" = "$signer_key_hash_before" ]
record 'auth_signer_key_persisted_across_restart=pass'
for grafana_database in hg_grafana_first hg_grafana_second; do
  if [ "$("$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default exec deployment/mt-db -- \
      mysql -h127.0.0.1 -uroot -proot_password -N -e \
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$grafana_database' AND table_name='cache_data';" 2>/dev/null)" = 1 ]; then
    "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default exec deployment/mt-db -- \
      mysql -h127.0.0.1 -uroot -proot_password -e \
      "DELETE FROM $grafana_database.cache_data WHERE cache_key LIKE 'id-token%';" >/dev/null 2>&1
  fi
done
sed -e "s|image: k3d-registry.localhost:1001/grafana-apiserver|image: $platform_image|" \
  -e 's|imagePullPolicy: Always|imagePullPolicy: Never\
          command: ["/usr/share/grafana/bin/grafana"]|' \
  -e 's|secretName: apiserver-certs|secretName: error-tracking-authz-tls|' \
  "$enterprise_source/src/devenv/mt-tilt/k8s/authz-service.yaml" \
  | "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" apply -f - >/dev/null
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default rollout restart deployment/authz-service >/dev/null
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n default rollout status deployment/authz-service --timeout=300s >/dev/null

sed "s|image: error-tracking-api:local|image: $api_image|" \
  "$root/deploy/local-k8s/error-tracking-api.yaml" \
  | "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" apply -f - >/dev/null
kubectl_local scale deployment/error-tracking-apiserver --replicas="$api_replicas" >/dev/null
kubectl_local rollout restart deployment/error-tracking-apiserver >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
ready_api_replicas=$(kubectl_local get deployment/error-tracking-apiserver -o jsonpath='{.status.readyReplicas}')
[ "$ready_api_replicas" = "$api_replicas" ]
record "api_ready_replicas=$ready_api_replicas"

"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" apply -f - >/dev/null <<EOF
apiVersion: v1
kind: ConfigMap
metadata: {name: error-tracking-st-config, namespace: $namespace}
data:
  apiservices.yaml: |
    - group: error-tracking.grafana.app
      version: v0alpha1
      host: error-tracking-apiserver.error-tracking.svc.cluster.local
      port: 6461
  stack-11.ini: |
    [server]
    protocol = http
    http_port = 3000
    [environment]
    stack_id = 11
    [database]
    type = mysql
    host = mt-db.default.svc.cluster.local:3306
    name = hg_grafana_first
    user = superuser
    password = password
    ssl_mode = disable
    [feature_toggles]
    kubernetesAggregator = true
    kubernetesAggregatorCapTokenAuth = true
    grafana.rspackBuild = true
    aggregation.error-tracking-grafana-app.enabled = true
    aggregation.cap-token-auth.obo-signing = ENABLED
    [feature_toggles.openfeature]
    provider = static
    enable_api = true
    [auth.extended_jwt]
    enabled = true
    expect_claims = false
    jwks_url = http://auth-signer.default.svc.cluster.local:6481/jwks
    [id_forwarding]
    token = ThisIsMySecretToken
    sign_url = http://auth-signer.default.svc.cluster.local:6481/sign/id-token
    [grafana-apiserver]
    dev_mode_enabled = true
    remote_services_file = /etc/grafana-apiservices/apiservices.yaml
    aggregator_dev_mode_direct_to_service = true
    [grpc_client_authentication]
    token_exchange_url = http://auth-signer.default.svc.cluster.local:6481/sign/access-token
    token = ThisIsMySecretToken
    [analytics]
    reporting_enabled = false
    check_for_updates = false
    check_for_plugin_updates = false
    [plugins]
    preinstall_disabled = true
  stack-22.ini: |
    [server]
    protocol = http
    http_port = 3000
    [environment]
    stack_id = 22
    [database]
    type = mysql
    host = mt-db.default.svc.cluster.local:3306
    name = hg_grafana_second
    user = superuser
    password = password
    ssl_mode = disable
    [feature_toggles]
    kubernetesAggregator = true
    kubernetesAggregatorCapTokenAuth = true
    grafana.rspackBuild = true
    aggregation.error-tracking-grafana-app.enabled = true
    aggregation.cap-token-auth.obo-signing = ENABLED
    [feature_toggles.openfeature]
    provider = static
    enable_api = true
    [auth.extended_jwt]
    enabled = true
    expect_claims = false
    jwks_url = http://auth-signer.default.svc.cluster.local:6481/jwks
    [id_forwarding]
    token = ThisIsMySecretToken
    sign_url = http://auth-signer.default.svc.cluster.local:6481/sign/id-token
    [grafana-apiserver]
    dev_mode_enabled = true
    remote_services_file = /etc/grafana-apiservices/apiservices.yaml
    aggregator_dev_mode_direct_to_service = true
    [grpc_client_authentication]
    token_exchange_url = http://auth-signer.default.svc.cluster.local:6481/sign/access-token
    token = ThisIsMySecretToken
    [analytics]
    reporting_enabled = false
    check_for_updates = false
    check_for_plugin_updates = false
    [plugins]
    preinstall_disabled = true
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: st-grafana-11, namespace: $namespace}
spec:
  replicas: 1
  selector: {matchLabels: {app: st-grafana-11}}
  template:
    metadata: {labels: {app: st-grafana-11}}
    spec:
      containers:
        - name: grafana
          image: $platform_image
          imagePullPolicy: Never
          ports: [{name: http, containerPort: 3000}]
          env:
            - {name: GF_PATHS_CONFIG, value: /etc/grafana/custom.ini}
            - {name: GF_SECURITY_ADMIN_PASSWORD, value: admin}
          readinessProbe:
            httpGet: {path: /api/health, port: http}
            initialDelaySeconds: 2
            periodSeconds: 2
          volumeMounts:
            - {name: config, mountPath: /etc/grafana/custom.ini, subPath: stack-11.ini, readOnly: true}
            - {name: config, mountPath: /etc/grafana-apiservices/apiservices.yaml, subPath: apiservices.yaml, readOnly: true}
      volumes:
        - name: config
          configMap: {name: error-tracking-st-config}
---
apiVersion: v1
kind: Service
metadata: {name: st-grafana-11, namespace: $namespace}
spec:
  selector: {app: st-grafana-11}
  ports: [{name: http, port: 3000, targetPort: http}]
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: st-grafana-22, namespace: $namespace}
spec:
  replicas: 1
  selector: {matchLabels: {app: st-grafana-22}}
  template:
    metadata: {labels: {app: st-grafana-22}}
    spec:
      containers:
        - name: grafana
          image: $platform_image
          imagePullPolicy: Never
          ports: [{name: http, containerPort: 3000}]
          env:
            - {name: GF_PATHS_CONFIG, value: /etc/grafana/custom.ini}
            - {name: GF_SECURITY_ADMIN_PASSWORD, value: admin}
          readinessProbe:
            httpGet: {path: /api/health, port: http}
            initialDelaySeconds: 2
            periodSeconds: 2
          volumeMounts:
            - {name: config, mountPath: /etc/grafana/custom.ini, subPath: stack-22.ini, readOnly: true}
            - {name: config, mountPath: /etc/grafana-apiservices/apiservices.yaml, subPath: apiservices.yaml, readOnly: true}
      volumes:
        - name: config
          configMap: {name: error-tracking-st-config}
---
apiVersion: v1
kind: Service
metadata: {name: st-grafana-22, namespace: $namespace}
spec:
  selector: {app: st-grafana-22}
  ports: [{name: http, port: 3000, targetPort: http}]
EOF
kubectl_local rollout restart deployment/st-grafana-11 deployment/st-grafana-22 >/dev/null
kubectl_local rollout status deployment/st-grafana-11 --timeout=300s >/dev/null
kubectl_local rollout status deployment/st-grafana-22 --timeout=300s >/dev/null

if kubectl_local get deployment st-grafana-11 st-grafana-22 -o json | "$python_bin" -c 'import json,sys; forbidden={"PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE","ERROR_TRACKING_DATABASE_URL"}; items=json.load(sys.stdin)["items"]; raise SystemExit(0 if all(not ({e["name"] for e in x["spec"]["template"]["spec"]["containers"][0].get("env",[])} & forbidden) for x in items) else 1)'; then
  record 'ui_database_credentials=absent'
else
  echo 'UI pod unexpectedly has error-tracking database credentials' >&2
  exit 1
fi

start_forward default service/auth-signer 6481:6481
start_forward "$namespace" service/error-tracking-apiserver 6461:6461
api_forward_pid=$last_forward_pid
start_forward "$namespace" service/st-grafana-11 3311:3000
st11_forward_pid=$last_forward_pid
start_forward "$namespace" service/st-grafana-22 3322:3000
st22_forward_pid=$last_forward_pid
wait_http http://127.0.0.1:6481/jwks
wait_http http://127.0.0.1:3311/api/health
wait_http http://127.0.0.1:3322/api/health

stack11_api_token=$(mint_token 11 error-tracking.grafana.app)
stack22_api_token=$(mint_token 22 error-tracking.grafana.app)
wrong_audience_token=$(mint_token 11 grafana)
marker11="$cluster_name-stack-11-$(date +%s)"
marker22="$cluster_name-stack-22-$(date +%s)"
events11=http://127.0.0.1:3311/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events
events22=http://127.0.0.1:3322/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-22/events
direct11=https://error-tracking-apiserver.error-tracking.svc.cluster.local:6461/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events
direct_version=https://error-tracking-apiserver.error-tracking.svc.cluster.local:6461/apis/error-tracking.grafana.app/v0alpha1

curl -fsS -c "$scratch/stack11.cookies" -H 'Content-Type: application/json' \
  --data '{"user":"admin","password":"admin"}' http://127.0.0.1:3311/login >/dev/null
curl -fsS -c "$scratch/stack22.cookies" -H 'Content-Type: application/json' \
  --data '{"user":"admin","password":"admin"}' http://127.0.0.1:3322/login >/dev/null

for stack in 11 22; do
  port=$((3300 + stack))
  apiservice_url=http://127.0.0.1:$port/apis/apiregistration.k8s.io/v1/apiservices/v0alpha1.error-tracking.grafana.app
  i=0
  until curl --connect-timeout 2 --max-time 5 -fsS -b "$scratch/stack$stack.cookies" "$apiservice_url" >"$scratch/apiservice-$stack.json" 2>/dev/null \
    && "$python_bin" -c 'import json,sys; body=json.load(open(sys.argv[1])); assert any(x.get("type") == "Available" and x.get("status") == "True" for x in body.get("status",{}).get("conditions",[]))' "$scratch/apiservice-$stack.json" 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -lt 60 ] || { echo "remote APIService did not become available for stack $stack" >&2; exit 1; }
    sleep 2
  done
  record "remote_apiservice_stack_${stack}_available=pass"
done
i=0
until curl --connect-timeout 2 --max-time 5 -fsS -b "$scratch/stack11.cookies" \
  http://127.0.0.1:3311/apis/error-tracking.grafana.app/v0alpha1 >"$scratch/aggregated-discovery.json" 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || { echo 'aggregated API discovery did not become available' >&2; exit 1; }
  sleep 2
done
"$python_bin" -c 'import json,sys; body=json.load(open(sys.argv[1])); assert body == {"kind":"APIResourceList","apiVersion":"v1","groupVersion":"error-tracking.grafana.app/v0alpha1","resources":[]}' "$scratch/aggregated-discovery.json"
record 'aggregated_route_only_discovery=pass'
curl -fsS -b "$scratch/stack11.cookies" http://127.0.0.1:3311/openapi/v2 >"$scratch/aggregated-openapi.json"
"$python_bin" -c 'import json,sys; paths=json.load(open(sys.argv[1]))["paths"]; assert any(path.endswith("/events") for path in paths)' "$scratch/aggregated-openapi.json"
record 'aggregated_openapi_events_route=pass'
curl -fsS -b "$scratch/stack11.cookies" http://127.0.0.1:3311/openapi/v3 >/dev/null
record 'aggregated_openapi_v3=pass'
wait_authenticated_events "$scratch/stack11.cookies" "$events11"
wait_authenticated_events "$scratch/stack22.cookies" "$events22"
curl -fsS -b "$scratch/stack11.cookies" -H 'Content-Type: application/json' \
  --data "{\"project\":\"native-local\",\"message\":\"$marker11\"}" "$events11" >/dev/null
curl -fsS -b "$scratch/stack22.cookies" -H 'Content-Type: application/json' \
  --data "{\"project\":\"native-local\",\"message\":\"$marker22\"}" "$events22" >/dev/null
body=$(curl -fsS -b "$scratch/stack11.cookies" "$events11")
printf '%s' "$body" | OWN="$marker11" OTHER="$marker22" "$python_bin" -c 'import json,os,sys; messages={x["message"] for x in json.load(sys.stdin)["items"]}; assert os.environ["OWN"] in messages and os.environ["OTHER"] not in messages'
record 'stack11_logged_in_ui_api_post_get_and_isolation=pass'
body=$(curl -fsS -b "$scratch/stack22.cookies" "$events22")
printf '%s' "$body" | OWN="$marker22" OTHER="$marker11" "$python_bin" -c 'import json,os,sys; messages={x["message"] for x in json.load(sys.stdin)["items"]}; assert os.environ["OWN"] in messages and os.environ["OTHER"] not in messages'
record 'stack22_logged_in_ui_api_post_get_and_isolation=pass'

viewer_login="viewer-$cluster_name-$(date +%s)"
viewer_password="LocalViewer-$(date +%s)-$api_replicas"
curl -fsS -u admin:admin -H 'Content-Type: application/json' \
  --data "{\"name\":\"Local Viewer\",\"email\":\"$viewer_login@example.invalid\",\"login\":\"$viewer_login\",\"password\":\"$viewer_password\"}" \
  http://127.0.0.1:3311/api/admin/users >/dev/null
curl -fsS -c "$scratch/viewer.cookies" -H 'Content-Type: application/json' \
  --data "{\"user\":\"$viewer_login\",\"password\":\"$viewer_password\"}" http://127.0.0.1:3311/login >/dev/null
curl -fsS -b "$scratch/viewer.cookies" http://127.0.0.1:3311/api/user/orgs >"$scratch/viewer-orgs.json"
"$python_bin" -c 'import json,sys; assert any(x["orgId"] == 1 and x["role"] == "Viewer" for x in json.load(open(sys.argv[1])))' "$scratch/viewer-orgs.json"
curl -fsS -b "$scratch/viewer.cookies" "$events11" >/dev/null
viewer_marker="$cluster_name-viewer-denied-$(date +%s)"
status=$(curl -sS -o "$scratch/viewer-post.json" -w '%{http_code}' -b "$scratch/viewer.cookies" \
  -H 'Content-Type: application/json' --data "{\"project\":\"native-local\",\"message\":\"$viewer_marker\"}" "$events11")
[ "$status" = 403 ]
body=$(curl -fsS -b "$scratch/stack11.cookies" "$events11")
printf '%s' "$body" | MARKER="$viewer_marker" "$python_bin" -c 'import json,os,sys; assert all(x["message"] != os.environ["MARKER"] for x in json.load(sys.stdin)["items"])'
record 'viewer_read_allowed_create_denied_without_write=pass'

audit_marker="$cluster_name-audit-$(date +%s)"
curl -fsS -b "$scratch/stack11.cookies" -H 'Content-Type: application/json' \
  --data "{\"project\":\"audit-proof\",\"message\":\"$audit_marker\"}" "$events11" >/dev/null
curl -fsS -b "$scratch/stack11.cookies" "$events11" >/dev/null
i=0
until kubectl_local logs -l app=error-tracking-apiserver --all-containers=true --prefix=true --since=2m >"$scratch/api-audit.log" 2>/dev/null \
  && "$python_bin" - "$scratch/api-audit.log" <<'PY' 2>/dev/null
import json
import sys

lines = open(sys.argv[1], encoding="utf-8").read().splitlines()
audit = []
for line in lines:
    try:
        event = json.loads(line[line.index("{"):])
    except (ValueError, json.JSONDecodeError):
        continue
    uri = event.get("requestURI", "")
    identity = event.get("user", {})
    user = identity.get("uid", "") or identity.get("username", "")
    if (event.get("level") == "Metadata" and "/apis/error-tracking.grafana.app/" in uri
            and "/namespaces/stacks-11/events" in uri and user.startswith("user:")):
        audit.append(event)
assert any(event.get("verb") == "create" and event.get("responseStatus", {}).get("code") == 200 for event in audit)
assert any(event.get("verb") == "list" and event.get("responseStatus", {}).get("code") == 200 for event in audit)
PY
do
  i=$((i + 1))
  [ "$i" -lt 30 ] || { echo 'metadata audit entries did not appear' >&2; exit 1; }
  sleep 1
done
if grep -Fq "$marker11" "$scratch/api-audit.log" || grep -Fq "$marker22" "$scratch/api-audit.log" \
    || grep -Fq "$audit_marker" "$scratch/api-audit.log"; then
  echo 'event body appeared in metadata audit logs' >&2
  exit 1
fi
record 'metadata_audit_create_list_identity_tenant_outcome=pass'
record 'metadata_audit_event_body_absent=pass'

api_scaled_down=1
kubectl_local scale deployment/error-tracking-apiserver --replicas=0 >/dev/null
kubectl_local wait --for=delete pod -l app=error-tracking-apiserver --timeout=180s >/dev/null
status=$(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' -b "$scratch/stack11.cookies" "$events11" || true)
case "$status" in 000|502|503|504) ;; *) echo "expected UI-facing API failure while API pod was stopped, got $status" >&2; exit 1 ;; esac
record "ui_route_without_api_status=$status"
kubectl_local scale deployment/error-tracking-apiserver --replicas="$api_replicas" >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
api_scaled_down=0
kill "$api_forward_pid" 2>/dev/null || true
start_forward "$namespace" service/error-tracking-apiserver 6461:6461
api_forward_pid=$last_forward_pid
kill "$st11_forward_pid" "$st22_forward_pid" 2>/dev/null || true
start_forward "$namespace" service/st-grafana-11 3311:3000
st11_forward_pid=$last_forward_pid
start_forward "$namespace" service/st-grafana-22 3322:3000
st22_forward_pid=$last_forward_pid
wait_http http://127.0.0.1:3311/api/health
wait_http http://127.0.0.1:3322/api/health
wait_https_insecure https://127.0.0.1:6461/readyz
body=$(curl -fsS -b "$scratch/stack11.cookies" "$events11")
printf '%s' "$body" | MARKER="$marker11" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(sys.stdin)["items"])'
record 'ui_route_restored_with_saved_event=pass'

status=$(curl -sS -o /dev/null -w '%{http_code}' --cacert "$scratch/ca.crt" \
  --resolve error-tracking-apiserver.error-tracking.svc.cluster.local:6461:127.0.0.1 "$direct11")
case "$status" in 401|403) ;; *) echo "unexpected anonymous API status $status" >&2; exit 1 ;; esac
record "anonymous_api_status=$status"
status=$(curl -sS -o /dev/null -w '%{http_code}' --cacert "$scratch/ca.crt" \
  --resolve error-tracking-apiserver.error-tracking.svc.cluster.local:6461:127.0.0.1 -H "X-Access-Token: $wrong_audience_token" "$direct11")
case "$status" in 401|403) ;; *) echo "unexpected wrong-audience API status $status" >&2; exit 1 ;; esac
record "wrong_audience_api_status=$status"
status=$(curl -sS -o /dev/null -w '%{http_code}' --cacert "$scratch/ca.crt" \
  --resolve error-tracking-apiserver.error-tracking.svc.cluster.local:6461:127.0.0.1 -H "X-Access-Token: $stack22_api_token" "$direct11")
[ "$status" = 403 ]
record 'cross_stack_api_status=403'
curl -fsS --cacert "$scratch/ca.crt" --resolve error-tracking-apiserver.error-tracking.svc.cluster.local:6461:127.0.0.1 \
  -H "X-Access-Token: $stack11_api_token" "$direct11" >/dev/null
record 'api_tls_ca_verification=pass'
curl -fsS --cacert "$scratch/ca.crt" --resolve error-tracking-apiserver.error-tracking.svc.cluster.local:6461:127.0.0.1 \
  -H "X-Access-Token: $stack11_api_token" "$direct_version" >"$scratch/direct-discovery.json"
"$python_bin" -c 'import json,sys; body=json.load(open(sys.argv[1])); assert body == {"kind":"APIResourceList","apiVersion":"v1","groupVersion":"error-tracking.grafana.app/v0alpha1","resources":[]}' "$scratch/direct-discovery.json"
record 'direct_route_only_discovery=pass'
curl -fsS --cacert "$scratch/ca.crt" --resolve error-tracking-apiserver.error-tracking.svc.cluster.local:6461:127.0.0.1 \
  -H "X-Access-Token: $stack11_api_token" https://error-tracking-apiserver.error-tracking.svc.cluster.local:6461/openapi/v2 >"$scratch/direct-openapi.json"
"$python_bin" -c 'import json,sys; paths=json.load(open(sys.argv[1]))["paths"]; assert any(path.endswith("/events") for path in paths)' "$scratch/direct-openapi.json"
record 'direct_openapi_events_route=pass'

api_pods=$(kubectl_local get pod -l app=error-tracking-apiserver -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')
[ "$(printf '%s\n' "$api_pods" | sed '/^$/d' | wc -l | tr -d ' ')" = "$api_replicas" ]
replica_port=6462
for api_pod in $api_pods; do
  start_forward "$namespace" "pod/$api_pod" "$replica_port:6443"
  replica_forward_pid=$last_forward_pid
  wait_https_insecure "https://127.0.0.1:$replica_port/readyz"
  curl -fsS --cacert "$scratch/ca.crt" \
    --resolve "error-tracking-apiserver.error-tracking.svc.cluster.local:$replica_port:127.0.0.1" \
    -H "X-Access-Token: $stack11_api_token" \
    "https://error-tracking-apiserver.error-tracking.svc.cluster.local:$replica_port/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events" >/dev/null
  kill "$replica_forward_pid" 2>/dev/null || true
  replica_port=$((replica_port + 1))
done
record "api_replicas_functional=$api_replicas"

old_api_pod=$(printf '%s\n' "$api_pods" | sed -n '1p')
kubectl_local delete pod "$old_api_pod" --wait=false >/dev/null
kubectl_local wait --for=delete "pod/$old_api_pod" --timeout=180s >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
ready_api_replicas=$(kubectl_local get deployment/error-tracking-apiserver -o jsonpath='{.status.readyReplicas}')
[ "$ready_api_replicas" = "$api_replicas" ]
i=0
until body=$(curl --connect-timeout 2 --max-time 10 -fsS -b "$scratch/stack11.cookies" "$events11" 2>/dev/null) \
  && printf '%s' "$body" | MARKER="$marker11" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(sys.stdin)["items"])' 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || { echo 'UI route did not recover after one API replica was replaced' >&2; exit 1; }
  sleep 2
done
record 'single_api_replica_replacement_recovered=pass'

api_state_before=$(kubectl_local get pod -l app=error-tracking-apiserver -o json | "$python_bin" -c 'import json,sys; print("\n".join(sorted("{}:{}:{}".format(x["metadata"]["name"], x["metadata"]["uid"], x["status"]["containerStatuses"][0]["restartCount"]) for x in json.load(sys.stdin)["items"])))')
readiness_pod=$(printf '%s\n' "$api_state_before" | sed -n '1s/:.*//p')
start_forward "$namespace" "pod/$readiness_pod" 6464:6443
postgres_scaled_down=1
kubectl_local scale statefulset/error-tracking-postgres --replicas=0 >/dev/null
kubectl_local wait --for=delete pod/error-tracking-postgres-0 --timeout=180s >/dev/null
i=0
while [ "$(kubectl_local get deployment/error-tracking-apiserver -o jsonpath='{.status.readyReplicas}')" != '' ]; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || { echo 'API replicas remained ready while PostgreSQL was unavailable' >&2; exit 1; }
  sleep 2
done
curl -kfsS --connect-timeout 2 --max-time 5 https://127.0.0.1:6464/livez >/dev/null
sleep 12
api_state_after=$(kubectl_local get pod -l app=error-tracking-apiserver -o json | "$python_bin" -c 'import json,sys; print("\n".join(sorted("{}:{}:{}".format(x["metadata"]["name"], x["metadata"]["uid"], x["status"]["containerStatuses"][0]["restartCount"]) for x in json.load(sys.stdin)["items"])))')
[ "$api_state_after" = "$api_state_before" ]
kubectl_local scale statefulset/error-tracking-postgres --replicas=1 >/dev/null
kubectl_local rollout status statefulset/error-tracking-postgres --timeout=300s >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
postgres_scaled_down=0
body=$(curl --connect-timeout 2 --max-time 10 -fsS -b "$scratch/stack11.cookies" "$events11")
printf '%s' "$body" | MARKER="$marker11" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(sys.stdin)["items"])'
record 'database_readiness_failed_liveness_stayed_up_and_recovered=pass'

old_runtime_password=$(kubectl_local get secret error-tracking-runtime -o jsonpath='{.data.password}' | base64 -d)
KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" "$root/deploy/local-k8s/rotate-runtime-secret.sh" >/dev/null
if printf '%s\n' "$old_runtime_password" | kubectl_local exec -i statefulset/error-tracking-postgres -- sh -c \
  'IFS= read -r PGPASSWORD; export PGPASSWORD; psql -h error-tracking-postgres -U error_tracking_app -d error_tracking -Atc "SELECT 1" >/dev/null 2>&1' 2>/dev/null; then
  echo 'previous runtime database credential still authenticates after rotation' >&2
  exit 1
fi
attempt=0
aggregator_recovery=automatic
until body=$(curl --connect-timeout 2 --max-time 3 -fsS -b "$scratch/stack11.cookies" "$events11" 2>/dev/null) \
  && printf '%s' "$body" | MARKER="$marker11" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(sys.stdin)["items"])' 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 10 ]; then
    aggregator_recovery=grafana_restart_required
    break
  fi
  sleep 2
done
if [ "$aggregator_recovery" = grafana_restart_required ]; then
  kubectl_local rollout restart deployment/st-grafana-11 deployment/st-grafana-22 >/dev/null
  kubectl_local rollout status deployment/st-grafana-11 --timeout=300s >/dev/null
  kubectl_local rollout status deployment/st-grafana-22 --timeout=300s >/dev/null
  kill "$st11_forward_pid" "$st22_forward_pid" 2>/dev/null || true
  start_forward "$namespace" service/st-grafana-11 3311:3000
  st11_forward_pid=$last_forward_pid
  start_forward "$namespace" service/st-grafana-22 3322:3000
  st22_forward_pid=$last_forward_pid
  wait_http http://127.0.0.1:3311/api/health
  wait_http http://127.0.0.1:3322/api/health
  curl -fsS -c "$scratch/stack11.cookies" -H 'Content-Type: application/json' \
    --data '{"user":"admin","password":"admin"}' http://127.0.0.1:3311/login >/dev/null
  body=$(curl --connect-timeout 2 --max-time 10 -fsS -b "$scratch/stack11.cookies" "$events11")
  printf '%s' "$body" | MARKER="$marker11" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(sys.stdin)["items"])'
fi
record 'runtime_credential_rotation_old_rejected_new_serves_saved_event=pass'
record "runtime_credential_rotation_aggregator_recovery=$aggregator_recovery"

api_image_id=$(docker image inspect "$api_image" --format '{{.Id}}')
runtime_image_id=$(kubectl_local get pod -l app=error-tracking-apiserver -o jsonpath='{.items[0].status.containerStatuses[0].imageID}')
binary_sha=$(kubectl_local exec deployment/error-tracking-apiserver -- sha256sum /usr/local/bin/error-tracking | awk '{print $1}')
record "api_config_image_id=$api_image_id"
record "runtime_image_id=$runtime_image_id"
record "api_binary_sha256=$binary_sha"
KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" "$root/deploy/local-k8s/prove-privileges.sh" >/dev/null
record 'runtime_role_privileges=pass'
record "cluster=$cluster_name"
[ -z "$docker_network" ] || record "docker_network=$docker_network pod_subnet=$pod_subnet service_subnet=$service_subnet"
record 'native_tls_limitation=aggregator_availability_and_proxy_transport_skip_remote_tls_verification; direct API CA verification passed'
record 'helper_exit=success'
completed=1
