#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
compose="$root/deploy/local-compose/compose.yaml"
kubeconfig=${KUBECONFIG:-"$root/.local-kubeconfig"}
context=${KUBE_CONTEXT:-kind-error-tracking-native}
namespace=error-tracking
kubectl_bin=${KUBECTL_BIN:-kubectl}
api_image=${API_IMAGE:-error-tracking-api:local}
grafana_image=${GRAFANA_IMAGE:-error-tracking-grafana:local}
signer_image=${SIGNER_IMAGE:-error-tracking-local-issuer:local}
cluster_name=${NATIVE_CLUSTER_NAME:-error-tracking-native}
build_images=${BUILD_IMAGES:-1}
load_images=${LOAD_IMAGES:-1}
create_cluster=${CREATE_CLUSTER:-1}
api_replicas=${API_REPLICAS:-2}
evidence=${EVIDENCE_FILE:-/tmp/error-tracking-native-evidence.txt}
docker_network=${NATIVE_DOCKER_NETWORK:-}
pod_subnet=${NATIVE_POD_SUBNET:-}
service_subnet=${NATIVE_SERVICE_SUBNET:-}
scratch=$(mktemp -d "${TMPDIR:-/tmp}/error-tracking-native.XXXXXX")
api_scaled_down=0
postgres_scaled_down=0
completed=0

case "$context" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local kube context: $context" >&2; exit 1 ;;
esac
case "$build_images:$load_images:$create_cluster" in
  0:0:0|0:0:1|0:1:0|0:1:1|1:0:0|1:0:1|1:1:0|1:1:1) ;;
  *) echo 'BUILD_IMAGES, LOAD_IMAGES, and CREATE_CLUSTER must be 0 or 1' >&2; exit 1 ;;
esac
[ "$context" = "kind-$cluster_name" ] || { echo 'KUBE_CONTEXT must match NATIVE_CLUSTER_NAME' >&2; exit 1; }
case "$api_replicas" in
  ''|*[!0-9]*) echo 'API_REPLICAS must be an integer of at least 2' >&2; exit 1 ;;
esac
[ "$api_replicas" -ge 2 ] || { echo 'API_REPLICAS must be at least 2' >&2; exit 1; }

kubectl_local() {
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n "$namespace" "$@"
}

record() {
  printf '%s\n' "$1" | tee -a "$evidence"
}

cleanup() {
  status=$?
  if [ "$api_scaled_down" = 1 ]; then
    kubectl_local scale deployment/error-tracking-apiserver --replicas="$api_replicas" >/dev/null 2>&1 || true
  fi
  if [ "$postgres_scaled_down" = 1 ]; then
    kubectl_local scale statefulset/error-tracking-postgres --replicas=1 >/dev/null 2>&1 || true
  fi
  if [ "$completed" != 1 ] && [ "$status" -ne 0 ]; then
    kubectl_local get pods -o wide >"/tmp/$cluster_name-failed-pods.txt" 2>&1 || true
    kubectl_local logs -l app=error-tracking-apiserver --all-containers --prefix --since=10m \
      >"/tmp/$cluster_name-failed-api.log" 2>&1 || true
  fi
  rm -rf "$scratch"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

probe() {
  kubectl_local exec pod/error-tracking-proof -- "$@"
}

wait_plugin() {
  service=$1
  cookie=$2
  attempts=0
  while :; do
    status=$(probe sh -ec 'stack=${1#grafana-}; curl --connect-timeout 2 --max-time 8 -sS -b "$2" -c "$2" -o /tmp/plugin-body -w "%{http_code}" "http://$1:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-$stack/events" || true' sh "$service" "$cookie")
    [ "$status" = 200 ] && return
    attempts=$((attempts + 1))
    [ "$attempts" -lt 60 ] || { echo "plugin route for $service did not become ready (HTTP $status)" >&2; exit 1; }
    sleep 2
  done
}

login_grafana() {
  service=$1
  user=$2
  password=$3
  cookie=$4
  attempts=0
  while :; do
    status=$(probe sh -ec 'payload=$(printf "{\"user\":\"%s\",\"password\":\"%s\"}" "$2" "$3"); curl --connect-timeout 2 --max-time 8 -sS -c "$4" -H "Content-Type: application/json" --data "$payload" -o /tmp/login -w "%{http_code}" "http://$1:3000/login" || true' sh "$service" "$user" "$password" "$cookie")
    [ "$status" = 200 ] && return
    attempts=$((attempts + 1))
    [ "$attempts" -lt 60 ] || { echo "login for $service did not become ready (HTTP $status)" >&2; exit 1; }
    sleep 2
  done
}

plugin_body() {
  service=$1
  cookie=$2
  probe sh -ec 'stack=${1#grafana-}; curl --connect-timeout 2 --max-time 10 -fsS -b "$2" -c "$2" "http://$1:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-$stack/events"' sh "$service" "$cookie"
}

plugin_post_status() {
  service=$1
  cookie=$2
  project=$3
  message=$4
  probe sh -ec 'stack=${1#grafana-}; payload=$(printf "{\"project\":\"%s\",\"message\":\"%s\"}" "$3" "$4"); curl --connect-timeout 2 --max-time 10 -sS -b "$2" -c "$2" -H "Content-Type: application/json" --data "$payload" -o /tmp/plugin-post -w "%{http_code}" "http://$1:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-$stack/events" || true' sh "$service" "$cookie" "$project" "$message"
}

assert_contains() {
  value=$1
  expected=$2
  case "$value" in
    *"$expected"*) ;;
    *) echo "expected response to contain marker $expected" >&2; exit 1 ;;
  esac
}

assert_not_contains() {
  value=$1
  unexpected=$2
  case "$value" in
    *"$unexpected"*) echo "response leaked marker $unexpected" >&2; exit 1 ;;
    *) ;;
  esac
}

import_image() {
  image=$1
  for node in $kind_nodes; do
    docker image save "$image" | docker exec --privileged -i "$node" ctr --namespace=k8s.io images import - >/dev/null
  done
}

wait_node_containerd() {
  node=$1
  attempts=0
  until docker exec "$node" ctr version >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    [ "$attempts" -lt 60 ] || { echo "containerd did not become ready in kind node $node" >&2; exit 1; }
    sleep 1
  done
}

: >"$evidence"
command -v docker >/dev/null
command -v "$kubectl_bin" >/dev/null
docker info >/dev/null
kind_nodes=$(docker ps --filter "label=io.x-k8s.kind.cluster=$cluster_name" --format '{{.Names}}')
if [ -z "$kind_nodes" ]; then
  existing_nodes=$(docker ps -a --filter "label=io.x-k8s.kind.cluster=$cluster_name" --format '{{.Names}}')
  [ -z "$existing_nodes" ] || { echo "kind cluster $cluster_name exists but is not running" >&2; exit 1; }
  [ "$create_cluster" = 1 ] || { echo "kind cluster $cluster_name does not exist" >&2; exit 1; }
  if [ -n "$docker_network" ]; then
    [ -n "$pod_subnet" ] && [ -n "$service_subnet" ] || { echo 'custom Docker networks require pod and service subnets' >&2; exit 1; }
    docker network inspect "$docker_network" >/dev/null 2>&1 || docker network create "$docker_network" >/dev/null
    cat >"$scratch/kind.yaml" <<EOF_KIND
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  podSubnet: "$pod_subnet"
  serviceSubnet: "$service_subnet"
EOF_KIND
    KIND_EXPERIMENTAL_DOCKER_NETWORK="$docker_network" \
      "$root/deploy/local-k8s/kind.sh" create cluster --name "$cluster_name" --kubeconfig "$kubeconfig" --wait 5m --config "$scratch/kind.yaml"
  else
    "$root/deploy/local-k8s/kind.sh" create cluster --name "$cluster_name" --kubeconfig "$kubeconfig" --wait 5m
  fi
  kind_nodes=$(docker ps --filter "label=io.x-k8s.kind.cluster=$cluster_name" --format '{{.Names}}')
else
  "$root/deploy/local-k8s/kind.sh" export kubeconfig --name "$cluster_name" --kubeconfig "$kubeconfig" >/dev/null
fi
[ -n "$kind_nodes" ] || { echo "no running kind nodes found for $cluster_name" >&2; exit 1; }
"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" cluster-info >/dev/null
for node in $kind_nodes; do
  wait_node_containerd "$node"
done

if [ "$build_images" = 1 ]; then
  docker compose -p "$cluster_name" -f "$compose" build api auth-signer grafana
fi
for image in "$api_image" "$grafana_image" "$signer_image"; do
  docker image inspect "$image" >/dev/null
done
if [ "$load_images" = 1 ]; then
  import_image "$api_image"
  import_image "$grafana_image"
  import_image "$signer_image"
fi

# Reuse the Compose initializer so certificates and issuer configuration have
# one local source. It runs OpenSSL inside its container.
docker compose -p "$cluster_name" -f "$compose" run --rm fixtures >/dev/null
docker compose -p "$cluster_name" -f "$compose" run --rm --no-deps --entrypoint /bin/sh \
  -v "$scratch:/export" fixtures -ec 'cp -a /out/. /export/'
host_uid=$(id -u)
host_gid=$(id -g)
docker run --rm -e HOST_UID="$host_uid" -e HOST_GID="$host_gid" -v "$scratch:/work" alpine:3.22 sh -ec '
  if [ -f /work/grafana.ini ]; then
    cp /work/grafana.ini /work/grafana-11.ini
    sed -e "s/stack_id = 11/stack_id = 22/" -e "s/name = hg_grafana_first/name = hg_grafana_second/" /work/grafana.ini >/work/grafana-22.ini
  fi
  test -s /work/grafana-11.ini
  test -s /work/grafana-22.ini
  chown -R "$HOST_UID:$HOST_GID" /work
  chmod 600 /work/certs/*.key /work/runtime-password
'

"$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" apply -f "$root/deploy/local-k8s/postgres.yaml" >/dev/null
kubectl_local rollout status statefulset/error-tracking-postgres --timeout=300s >/dev/null
kubectl_local create configmap error-tracking-fixtures \
  --from-file=grafana-11.ini="$scratch/grafana-11.ini" \
  --from-file=grafana-22.ini="$scratch/grafana-22.ini" \
  --from-file=apiservices.yaml="$scratch/apiservices.yaml" \
  --from-file=plugin-provisioning.yaml="$scratch/provisioning/plugins/error-tracking.yaml" \
  --dry-run=client -o yaml | kubectl_local apply -f - >/dev/null
kubectl_local create configmap error-tracking-api-config --from-file=config.json="$scratch/config.json" \
  --dry-run=client -o yaml | kubectl_local apply -f - >/dev/null
kubectl_local create secret generic error-tracking-tls \
  --from-file=ca.crt="$scratch/certs/ca.crt" \
  --from-file=api.crt="$scratch/certs/api.crt" --from-file=api.key="$scratch/certs/api.key" \
  --dry-run=client -o yaml | kubectl_local apply -f - >/dev/null
KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" KUBECTL_BIN="$kubectl_bin" API_IMAGE="$api_image" \
  "$root/deploy/local-k8s/run-migration.sh" >/dev/null

kubectl_local apply -f "$root/deploy/local-k8s/platform.yaml" >/dev/null
kubectl_local set image deployment/auth-signer auth-signer="$signer_image" >/dev/null
kubectl_local set image deployment/grafana-11 grafana="$grafana_image" >/dev/null
kubectl_local set image deployment/grafana-22 grafana="$grafana_image" >/dev/null
kubectl_local apply -f "$root/deploy/local-k8s/error-tracking-api.yaml" >/dev/null
kubectl_local set image deployment/error-tracking-apiserver error-tracking-apiserver="$api_image" >/dev/null
kubectl_local scale deployment/error-tracking-apiserver --replicas="$api_replicas" >/dev/null
kubectl_local rollout restart deployment/auth-signer deployment/grafana-11 deployment/grafana-22 deployment/error-tracking-apiserver >/dev/null
kubectl_local rollout status deployment/auth-signer --timeout=300s >/dev/null
kubectl_local rollout status deployment/grafana-11 --timeout=300s >/dev/null
kubectl_local rollout status deployment/grafana-22 --timeout=300s >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null

ready_replicas=$(kubectl_local get deployment/error-tracking-apiserver -o jsonpath='{.status.readyReplicas}')
[ "$ready_replicas" = "$api_replicas" ]
record "api_ready_replicas=$ready_replicas"

kubectl_local delete pod error-tracking-proof --ignore-not-found --wait=true >/dev/null
kubectl_local apply -f - >/dev/null <<'EOF_PROBE'
apiVersion: v1
kind: Pod
metadata:
  name: error-tracking-proof
  namespace: error-tracking
spec:
  restartPolicy: Never
  containers:
    - name: curl
      image: curlimages/curl:8.12.1
      command: [sh, -c, 'sleep 3600']
      volumeMounts:
        - {name: tls, mountPath: /etc/error-tracking/certs, readOnly: true}
  volumes:
    - {name: tls, secret: {secretName: error-tracking-tls}}
EOF_PROBE
kubectl_local wait --for=condition=Ready pod/error-tracking-proof --timeout=180s >/dev/null

ui_env=$(kubectl_local get deployment/grafana-11 deployment/grafana-22 -o jsonpath='{range .items[*].spec.template.spec.containers[*].env[*]}{.name}{" "}{end}')
case " $ui_env " in
  *' PGHOST '*|*' PGPORT '*|*' PGUSER '*|*' PGPASSWORD '*|*' PGDATABASE '*|*' ERROR_TRACKING_DATABASE_URL '*)
    echo 'Grafana pod unexpectedly has event database credentials' >&2; exit 1 ;;
  *) record 'ui_database_credentials=absent' ;;
esac

signer_hash_line=$(kubectl_local exec deployment/auth-signer -- sha256sum /app/data/keys/es256.key)
signer_hash_before=${signer_hash_line%% *}
kubectl_local rollout restart deployment/auth-signer >/dev/null
kubectl_local rollout status deployment/auth-signer --timeout=180s >/dev/null
signer_hash_line=$(kubectl_local exec deployment/auth-signer -- sha256sum /app/data/keys/es256.key)
signer_hash_after=${signer_hash_line%% *}
[ "$signer_hash_before" = "$signer_hash_after" ]
record 'auth_signer_key_persisted_across_restart=pass'

login_grafana grafana-11 admin admin /tmp/grafana-11.cookies
login_grafana grafana-22 admin admin /tmp/grafana-22.cookies
wait_plugin grafana-11 /tmp/grafana-11.cookies
wait_plugin grafana-22 /tmp/grafana-22.cookies
marker11="$cluster_name-stack-11-$(date +%s)"
marker22="$cluster_name-stack-22-$(date +%s)"
[ "$(plugin_post_status grafana-11 /tmp/grafana-11.cookies native-local "$marker11")" = 200 ]
[ "$(plugin_post_status grafana-22 /tmp/grafana-22.cookies native-local "$marker22")" = 200 ]
body11=$(plugin_body grafana-11 /tmp/grafana-11.cookies)
assert_contains "$body11" "$marker11"
assert_not_contains "$body11" "$marker22"
body22=$(plugin_body grafana-22 /tmp/grafana-22.cookies)
assert_contains "$body22" "$marker22"
assert_not_contains "$body22" "$marker11"
cross_query=$(probe sh -ec 'curl -fsS -b /tmp/grafana-11.cookies -c /tmp/grafana-11.cookies "http://grafana-11:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events?namespace=stacks-22"')
assert_contains "$cross_query" "$marker11"
assert_not_contains "$cross_query" "$marker22"
forged_tenant_status=$(probe sh -ec 'curl -sS -b /tmp/grafana-11.cookies -c /tmp/grafana-11.cookies -H "X-Grafana-Id: forged" -o /tmp/forged-tenant -w "%{http_code}" http://grafana-11:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-22/events')
[ "$forged_tenant_status" = 403 ]
method_status=$(probe sh -ec 'curl -sS -b /tmp/grafana-11.cookies -c /tmp/grafana-11.cookies -X DELETE -o /tmp/method-denied -w "%{http_code}" http://grafana-11:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events')
[ "$method_status" = 403 ]
record 'stack11_plugin_post_get_and_tenant_isolation=pass'
record 'stack22_plugin_post_get_and_tenant_isolation=pass'
record 'plugin_tenant_override_and_forged_cross_namespace_denied=pass'
record 'unknown_action_denied=pass'

rows=$(kubectl_local exec pod/error-tracking-postgres-0 -- psql -U error_tracking -d error_tracking -At \
  -c "SELECT tenant_namespace || ':' || message FROM error_tracking_event WHERE message IN ('$marker11','$marker22') ORDER BY tenant_namespace")
assert_contains "$rows" "stacks-11:$marker11"
assert_contains "$rows" "stacks-22:$marker22"
record 'postgres_exact_tenant_rows=pass'

viewer="viewer-$cluster_name-$(date +%s)"
viewer_password='LocalViewerProof-1'
create_status=$(probe sh -ec 'payload=$(printf "{\"name\":\"Local Viewer\",\"email\":\"%s@example.invalid\",\"login\":\"%s\",\"password\":\"%s\"}" "$1" "$1" "$2"); curl -sS -b /tmp/grafana-11.cookies -c /tmp/grafana-11.cookies -H "Content-Type: application/json" --data "$payload" -o /tmp/create-user -w "%{http_code}" http://grafana-11:3000/api/admin/users' sh "$viewer" "$viewer_password")
[ "$create_status" = 200 ]
login_grafana grafana-11 "$viewer" "$viewer_password" /tmp/viewer.cookies
wait_plugin grafana-11 /tmp/viewer.cookies
viewer_marker="$cluster_name-viewer-write-$(date +%s)"
[ "$(plugin_post_status grafana-11 /tmp/viewer.cookies native-local "$viewer_marker")" = 200 ]
assert_contains "$(plugin_body grafana-11 /tmp/viewer.cookies)" "$viewer_marker"
record 'authenticated_tenant_user_read_write=pass'

probe sh -ec '
  mint() {
    service=$1 cookie=$2 stack=$3 audience=$4 destination=$5
    bearer=ThisIsMySecretToken
    user=$(curl -fsS -b "$cookie" -c "$cookie" "http://$service:3000/api/user")
    id=$(printf "%s" "$user" | sed -n "s/.*\"id\":\([0-9][0-9]*\).*/\1/p")
    uid=$(printf "%s" "$user" | sed -n "s/.*\"uid\":\"\([^\"]*\)\".*/\1/p")
    org=$(printf "%s" "$user" | sed -n "s/.*\"orgId\":\([0-9][0-9]*\).*/\1/p")
    test -n "$id" && test -n "$uid" && test -n "$org"
    now=$(date +%s)
    expires=$((now + 3600))
    id_payload=$(printf "{\"namespace\":\"stacks-%s\",\"claims\":{\"sub\":\"user:%s\",\"aud\":[\"org:%s\"],\"iat\":%s,\"exp\":%s},\"extra\":{\"identifier\":\"%s\",\"type\":\"user\",\"authenticatedBy\":\"password\",\"username\":\"admin\",\"role\":\"Admin\"}}" "$stack" "$id" "$org" "$now" "$expires" "$uid")
    id_response=$(curl -fsS -H "Authorization: Bearer $bearer" -H "Content-Type: application/json" --data "$id_payload" http://auth-signer:8080/sign/id-token)
    id_token=$(printf "%s" "$id_response" | sed -n "s/.*\"token\":\"\([^\"]*\)\".*/\1/p")
    test -n "$id_token"
    payload=$(printf "{\"namespace\":\"stacks-%s\",\"audiences\":[\"%s\"],\"subjectToken\":\"%s\"}" "$stack" "$audience" "$id_token")
    response=$(curl -fsS -H "Authorization: Bearer $bearer" -H "Content-Type: application/json" --data "$payload" http://auth-signer:8080/sign/access-token)
    token=$(printf "%s" "$response" | sed -n "s/.*\"token\":\"\([^\"]*\)\".*/\1/p")
    test -n "$token"
    umask 077
    printf "%s" "$token" >"$destination"
  }
  mint grafana-11 /tmp/grafana-11.cookies 11 error-tracking.grafana.app /tmp/token11
  mint grafana-22 /tmp/grafana-22.cookies 22 error-tracking.grafana.app /tmp/token22
  mint grafana-11 /tmp/grafana-11.cookies 11 grafana /tmp/token-wrong
'

events11=https://api:6443/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events
anonymous_status=$(probe sh -ec 'curl -sS --cacert /etc/error-tracking/certs/ca.crt -o /tmp/direct-anon -w "%{http_code}" "$1"' sh "$events11")
case "$anonymous_status" in 401|403) ;; *) echo "anonymous direct API returned $anonymous_status" >&2; exit 1 ;; esac
wrong_status=$(probe sh -ec 'curl -sS --cacert /etc/error-tracking/certs/ca.crt -H "X-Access-Token: $(cat /tmp/token-wrong)" -o /tmp/direct-wrong -w "%{http_code}" "$1"' sh "$events11")
case "$wrong_status" in 401|403) ;; *) echo "wrong-audience direct API returned $wrong_status" >&2; exit 1 ;; esac
cross_status=$(probe sh -ec 'curl -sS --cacert /etc/error-tracking/certs/ca.crt -H "X-Access-Token: $(cat /tmp/token22)" -o /tmp/direct-cross -w "%{http_code}" "$1"' sh "$events11")
[ "$cross_status" = 403 ]
valid_status=$(probe sh -ec 'curl -sS --cacert /etc/error-tracking/certs/ca.crt -H "X-Access-Token: $(cat /tmp/token11)" -o /tmp/direct-valid -w "%{http_code}" "$1"' sh "$events11")
[ "$valid_status" = 200 ]
if probe sh -ec 'curl --connect-timeout 2 --max-time 5 -fsS https://api:6443/readyz >/dev/null 2>&1'; then
  echo 'API TLS unexpectedly validated without the fixture CA' >&2
  exit 1
fi
record "anonymous_api_status=$anonymous_status"
record "wrong_audience_api_status=$wrong_status"
record 'cross_stack_api_status=403'
record 'api_tls_ca_verification_and_untrusted_rejection=pass'

discovery=$(probe sh -ec 'curl -fsS --cacert /etc/error-tracking/certs/ca.crt https://api:6443/apis/error-tracking.grafana.app/v0alpha1 | tr -d "[:space:]"')
assert_contains "$discovery" '"kind":"APIResourceList"'
assert_contains "$discovery" '"groupVersion":"error-tracking.grafana.app/v0alpha1"'
openapi=$(probe sh -ec 'curl -fsS --cacert /etc/error-tracking/certs/ca.crt https://api:6443/openapi/v2')
assert_contains "$openapi" '/events'
[ "$(probe sh -ec 'curl -sS --cacert /etc/error-tracking/certs/ca.crt -o /dev/null -w "%{http_code}" https://api:6443/metrics')" = 200 ]
record 'direct_discovery_openapi_metrics=pass'

audit_marker="$cluster_name-audit-$(date +%s)"
[ "$(plugin_post_status grafana-11 /tmp/grafana-11.cookies audit-proof "$audit_marker")" = 200 ]
plugin_body grafana-11 /tmp/grafana-11.cookies >/dev/null
attempt=0
while :; do
  audit_log=$(kubectl_local logs -l app=error-tracking-apiserver --all-containers --prefix --since=2m 2>/dev/null || true)
  case "$audit_log" in
    *'"verb":"create"'*'/namespaces/stacks-11/events'*'"code":200'*|*'/namespaces/stacks-11/events'*'"verb":"create"'*'"code":200'*) break ;;
  esac
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo 'metadata audit create entry did not appear' >&2; exit 1; }
  sleep 1
done
case "$audit_log" in
  *"$marker11"*|*"$marker22"*|*"$audit_marker"*) echo 'event body appeared in metadata audit output' >&2; exit 1 ;;
esac
case "$audit_log" in
  *'"user":{'*'user:'*) ;;
  *) echo 'metadata audit output did not include the authenticated user' >&2; exit 1 ;;
esac
record 'metadata_audit_identity_tenant_outcome_without_event_body=pass'

api_scaled_down=1
kubectl_local scale deployment/error-tracking-apiserver --replicas=0 >/dev/null
kubectl_local wait --for=delete pod -l app=error-tracking-apiserver --timeout=180s >/dev/null
[ "$(probe sh -ec 'curl --connect-timeout 2 --max-time 5 -sS -o /dev/null -w "%{http_code}" http://grafana-11:3000/api/health')" = 200 ]
[ -z "$(kubectl_local get endpoints api -o jsonpath='{.subsets[*].addresses[*].ip}')" ]
outage_status=$(probe sh -ec 'curl --connect-timeout 2 --max-time 10 -sS -b /tmp/grafana-11.cookies -c /tmp/grafana-11.cookies -o /tmp/outage -w "%{http_code}" http://grafana-11:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events || true')
case "$outage_status" in 000|502|503|504) ;; *) echo "plugin route returned $outage_status during API outage" >&2; exit 1 ;; esac
record 'grafana_healthy_and_api_endpoints_empty_during_outage=pass'
kubectl_local scale deployment/error-tracking-apiserver --replicas="$api_replicas" >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
api_scaled_down=0
wait_plugin grafana-11 /tmp/grafana-11.cookies
body11=$(plugin_body grafana-11 /tmp/grafana-11.cookies)
assert_contains "$body11" "$marker11"
record "plugin_api_outage_status=$outage_status"
record 'plugin_route_restored_with_saved_event=pass'

api_pods=$(kubectl_local get pods -l app=error-tracking-apiserver -o jsonpath='{range .items[*]}{.metadata.name}{" "}{end}')
count=0
for api_pod in $api_pods; do
  count=$((count + 1))
  pod_ip=$(kubectl_local get pod "$api_pod" -o jsonpath='{.status.podIP}')
  status=$(probe sh -ec 'curl -sS --cacert /etc/error-tracking/certs/ca.crt --resolve "api:6443:$1" -H "X-Access-Token: $(cat /tmp/token11)" -o /tmp/replica -w "%{http_code}" "$2"' sh "$pod_ip" "$events11")
  [ "$status" = 200 ]
done
[ "$count" = "$api_replicas" ]
record "api_replicas_functional=$count"

old_api_pod=${api_pods%% *}
kubectl_local delete pod "$old_api_pod" --wait=false >/dev/null
kubectl_local wait --for=delete "pod/$old_api_pod" --timeout=180s >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
wait_plugin grafana-11 /tmp/grafana-11.cookies
assert_contains "$(plugin_body grafana-11 /tmp/grafana-11.cookies)" "$marker11"
record 'single_api_replica_replacement_recovered=pass'

api_pods=$(kubectl_local get pods -l app=error-tracking-apiserver -o jsonpath='{range .items[*]}{.metadata.name}{" "}{end}')
: >"$scratch/api-restarts-before"
for api_pod in $api_pods; do
  printf '%s %s\n' "$api_pod" "$(kubectl_local get pod "$api_pod" -o jsonpath='{.status.containerStatuses[0].restartCount}')" >>"$scratch/api-restarts-before"
done
postgres_scaled_down=1
kubectl_local scale statefulset/error-tracking-postgres --replicas=0 >/dev/null
kubectl_local wait --for=delete pod/error-tracking-postgres-0 --timeout=180s >/dev/null
attempt=0
while [ "$(kubectl_local get deployment/error-tracking-apiserver -o jsonpath='{.status.readyReplicas}')" != '' ] && [ "$(kubectl_local get deployment/error-tracking-apiserver -o jsonpath='{.status.readyReplicas}')" != 0 ]; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { echo 'API remained ready while PostgreSQL was unavailable' >&2; exit 1; }
  sleep 2
done
for api_pod in $api_pods; do
  pod_ip=$(kubectl_local get pod "$api_pod" -o jsonpath='{.status.podIP}')
  [ "$(probe sh -ec 'curl -sS --cacert /etc/error-tracking/certs/ca.crt --resolve "api:6443:$1" -o /dev/null -w "%{http_code}" https://api:6443/livez' sh "$pod_ip")" = 200 ]
done
sleep 12
while read -r api_pod restart_before; do
  restart_after=$(kubectl_local get pod "$api_pod" -o jsonpath='{.status.containerStatuses[0].restartCount}')
  [ "$restart_after" = "$restart_before" ] || { echo "$api_pod restarted while PostgreSQL was unavailable" >&2; exit 1; }
done <"$scratch/api-restarts-before"
kubectl_local scale statefulset/error-tracking-postgres --replicas=1 >/dev/null
kubectl_local rollout status statefulset/error-tracking-postgres --timeout=300s >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
postgres_scaled_down=0
wait_plugin grafana-11 /tmp/grafana-11.cookies
assert_contains "$(plugin_body grafana-11 /tmp/grafana-11.cookies)" "$marker11"
record 'database_readiness_failed_liveness_stayed_up_and_recovered=pass'

KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" KUBECTL_BIN="$kubectl_bin" \
  "$root/deploy/local-k8s/rotate-runtime-secret.sh" >/dev/null
wait_plugin grafana-11 /tmp/grafana-11.cookies
assert_contains "$(plugin_body grafana-11 /tmp/grafana-11.cookies)" "$marker11"
record 'runtime_credential_rotation_old_rejected_new_serves_saved_event=pass'

KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" KUBECTL_BIN="$kubectl_bin" \
  "$root/deploy/local-k8s/prove-privileges.sh" >/dev/null
record 'runtime_role_privileges=pass'
record "api_config_image_id=$(docker image inspect "$api_image" --format '{{.Id}}')"
record "api_runtime_image_id=$(kubectl_local get pod -l app=error-tracking-apiserver -o jsonpath='{.items[0].status.containerStatuses[0].imageID}')"
binary_hash_line=$(kubectl_local exec deployment/error-tracking-apiserver -- sha256sum /usr/local/bin/error-tracking)
record "api_binary_sha256=${binary_hash_line%% *}"
record "grafana_config_image_id=$(docker image inspect "$grafana_image" --format '{{.Id}}')"
record "cluster=$cluster_name context=$context"
record 'helper_exit=success'
completed=1
