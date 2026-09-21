#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
kubectl_bin=${KUBECTL_BIN:-kubectl}
api_image=${API_IMAGE:-error-tracking-api:local}
grafana_image=${GRAFANA_IMAGE:-error-tracking-grafana:local}
signer_image=${SIGNER_IMAGE:-error-tracking-local-issuer:local}
evidence_dir=${EVIDENCE_DIR:-/tmp/error-tracking-native-multienv}
base_evidence=${BASE_EVIDENCE_FILE:-/tmp/error-tracking-native-evidence.txt}
base_kubeconfig=${BASE_KUBECONFIG:-"$root/.local-kubeconfig"}
base_context=${BASE_CONTEXT:-kind-error-tracking-native}
previous_password=''
previous_ca=''
previous_jwks=''
previous_marker11=''
previous_marker22=''
mkdir -p "$evidence_dir"

case "$base_context" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-base local context: $base_context" >&2; exit 1 ;;
esac
[ -r "$base_evidence" ] && [ -r "$base_kubeconfig" ] || { echo 'run the base native proof first' >&2; exit 1; }

kubectl_at() {
  kubeconfig_arg=$1 context_arg=$2
  shift 2
  "$kubectl_bin" --kubeconfig "$kubeconfig_arg" --context "$context_arg" -n error-tracking "$@"
}

evidence_value() {
  key=$1 file=$2
  while IFS='=' read -r name value; do
    [ "$name" = "$key" ] && { printf '%s\n' "$value"; return; }
  done <"$file"
  return 1
}

postgres_at() {
  kubectl_at "$1" "$2" exec pod/error-tracking-postgres-0 -- \
    psql -U error_tracking -d error_tracking -v ON_ERROR_STOP=1 -Atc "$3"
}

plugin_body() {
  kubectl_at "$1" "$2" exec pod/error-tracking-proof -- sh -ec \
    'stack=${1#grafana-}; curl --connect-timeout 2 --max-time 10 -fsS -b "/tmp/grafana-$stack.cookies" -c "/tmp/grafana-$stack.cookies" "http://$1:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-$stack/events"' sh "$3"
}

plugin_post_status() {
  kubectl_at "$1" "$2" exec pod/error-tracking-proof -- sh -ec '
    payload=$(printf "{\"project\":\"multienv-concurrency\",\"message\":\"%s\"}" "$2")
    stack=${1#grafana-}
    curl --connect-timeout 2 --max-time 10 -sS -b "/tmp/grafana-$stack.cookies" -c "/tmp/grafana-$stack.cookies" -H "Content-Type: application/json" --data "$payload" -o /tmp/multienv-post -w "%{http_code}" "http://$1:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-$stack/events" || true
  ' sh "$3" "$4"
}

login_at() {
  kubectl_at "$1" "$2" exec pod/error-tracking-proof -- sh -ec '
    stack=${1#grafana-}
    payload=$(printf "{\"user\":\"admin\",\"password\":\"admin\"}")
    curl --connect-timeout 2 --max-time 10 -sS -c "/tmp/grafana-$stack.cookies" -H "Content-Type: application/json" --data "$payload" -o /tmp/login -w "%{http_code}" "http://$1:3000/login"
  ' sh "$3"
}

assert_contains() {
  case "$1" in *"$2"*) ;; *) echo "expected response to contain $2" >&2; exit 1 ;; esac
}

base_image=$(evidence_value api_config_image_id "$base_evidence")
base_runtime_image=$(evidence_value api_runtime_image_id "$base_evidence")
base_binary=$(evidence_value api_binary_sha256 "$base_evidence")
base_password=$(kubectl_at "$base_kubeconfig" "$base_context" get secret error-tracking-runtime -o jsonpath='{.data.password}')
base_ca=$(kubectl_at "$base_kubeconfig" "$base_context" get secret error-tracking-tls -o jsonpath='{.data.ca\.crt}')
base_jwks=$(kubectl_at "$base_kubeconfig" "$base_context" exec pod/error-tracking-proof -- curl -fsS http://auth-signer:8080/jwks)
[ -n "$base_image" ] && [ -n "$base_runtime_image" ] && [ -n "$base_binary" ] && [ -n "$base_password" ] && [ -n "$base_ca" ] && [ -n "$base_jwks" ]
[ "$(login_at "$base_kubeconfig" "$base_context" grafana-11)" = 200 ] || { echo 'base Grafana login failed' >&2; exit 1; }

run_environment() {
  cluster=$1 network=$2 pod_subnet=$3 service_subnet=$4
  kubeconfig="$evidence_dir/$cluster.kubeconfig"
  evidence="$evidence_dir/$cluster-evidence.txt"
  context="kind-$cluster"
  secondary_scaled_down=0
  fixtures_owned=0

  [ -z "$(docker ps -a --filter "label=io.x-k8s.kind.cluster=$cluster" --format '{{.Names}}')" ] || { echo "refusing pre-existing disposable cluster: $cluster" >&2; exit 1; }
  ! docker network inspect "$network" >/dev/null 2>&1 || { echo "refusing pre-existing disposable network: $network" >&2; exit 1; }
  [ -z "$(docker ps -a --filter "label=com.docker.compose.project=$cluster" --format '{{.Names}}')" ] || { echo "refusing pre-existing Compose project: $cluster" >&2; exit 1; }
  [ -z "$(docker volume ls --filter "label=com.docker.compose.project=$cluster" --format '{{.Name}}')" ] || { echo "refusing pre-existing Compose fixture volumes: $cluster" >&2; exit 1; }
  rm -f "$kubeconfig" "$evidence"
  docker network create "$network" >/dev/null

  cleanup_environment() {
    status=$?
    [ "$secondary_scaled_down" = 0 ] || kubectl_at "$kubeconfig" "$context" scale deployment/error-tracking-apiserver --replicas=2 >/dev/null 2>&1 || true
    "$root/deploy/local-k8s/kind.sh" delete cluster --name "$cluster" >/dev/null 2>&1 || true
    [ "$fixtures_owned" = 0 ] || docker compose -p "$cluster" -f "$root/deploy/local-compose/compose.yaml" down -v >/dev/null 2>&1 || true
    attempts=0
    while docker network inspect "$network" >/dev/null 2>&1; do
      docker network rm "$network" >/dev/null 2>&1 || true
      attempts=$((attempts + 1)); [ "$attempts" -lt 10 ] || break; sleep 1
    done
    return "$status"
  }
  trap cleanup_environment EXIT INT TERM

  fixtures_owned=1
  BUILD_IMAGES=0 LOAD_IMAGES=1 CREATE_CLUSTER=1 NATIVE_CLUSTER_NAME="$cluster" \
  KUBE_CONTEXT="$context" KUBECONFIG="$kubeconfig" NATIVE_DOCKER_NETWORK="$network" \
  NATIVE_POD_SUBNET="$pod_subnet" NATIVE_SERVICE_SUBNET="$service_subnet" \
  API_IMAGE="$api_image" GRAFANA_IMAGE="$grafana_image" SIGNER_IMAGE="$signer_image" \
  EVIDENCE_FILE="$evidence" KUBECTL_BIN="$kubectl_bin" "$root/deploy/local-k8s/prove-native.sh"

  [ "$(evidence_value helper_exit "$evidence")" = success ]
  [ "$(evidence_value runtime_role_privileges "$evidence")" = pass ]
  [ "$(evidence_value api_config_image_id "$evidence")" = "$base_image" ]
  [ "$(evidence_value api_runtime_image_id "$evidence")" = "$base_runtime_image" ]
  [ "$(evidence_value api_binary_sha256 "$evidence")" = "$base_binary" ]
  [ "$(login_at "$kubeconfig" "$context" grafana-11)" = 200 ]
  [ "$(login_at "$kubeconfig" "$context" grafana-22)" = 200 ]
  password=$(kubectl_at "$kubeconfig" "$context" get secret error-tracking-runtime -o jsonpath='{.data.password}')
  ca=$(kubectl_at "$kubeconfig" "$context" get secret error-tracking-tls -o jsonpath='{.data.ca\.crt}')
  jwks=$(kubectl_at "$kubeconfig" "$context" exec pod/error-tracking-proof -- curl -fsS http://auth-signer:8080/jwks)
  [ -n "$password" ] && [ "$password" != "$base_password" ]
  [ -n "$ca" ] && [ "$ca" != "$base_ca" ]
  [ -n "$jwks" ] && [ "$jwks" != "$base_jwks" ]
  [ -z "$previous_password" ] || [ "$password" != "$previous_password" ]
  [ -z "$previous_ca" ] || [ "$ca" != "$previous_ca" ]
  [ -z "$previous_jwks" ] || [ "$jwks" != "$previous_jwks" ]
  printf '%s\n' 'base_image_and_binary_match=pass' 'runtime_password_unique=pass' 'tls_ca_and_signer_key_unique=pass' >>"$evidence"

  marker11=$(postgres_at "$kubeconfig" "$context" "SELECT message FROM error_tracking_event WHERE tenant_namespace='stacks-11' AND project='native-local' AND message LIKE '$cluster-stack-11-%'")
  marker22=$(postgres_at "$kubeconfig" "$context" "SELECT message FROM error_tracking_event WHERE tenant_namespace='stacks-22' AND project='native-local' AND message LIKE '$cluster-stack-22-%'")
  case "$marker11:$marker22" in *'
'*) echo 'expected exactly one marker per tenant' >&2; exit 1 ;; esac
  [ -n "$marker11" ] && [ -n "$marker22" ]
  [ -z "$previous_marker11" ] || [ "$marker11" != "$previous_marker11" ]
  [ -z "$previous_marker22" ] || [ "$marker22" != "$previous_marker22" ]
  [ "$(postgres_at "$kubeconfig" "$context" "SELECT count(*) FROM error_tracking_event WHERE message IN ('$marker11','$marker22') AND tenant_namespace NOT IN ('stacks-11','stacks-22')")" = 0 ]
  [ "$(postgres_at "$base_kubeconfig" "$base_context" "SELECT count(*) FROM error_tracking_event WHERE message IN ('$marker11','$marker22')")" = 0 ]
  printf '%s\n' 'environment_markers_and_tenant_isolation=pass' >>"$evidence"

  kubectl_at "$kubeconfig" "$context" exec pod/error-tracking-postgres-0 -- pg_isready -h error-tracking-postgres -p 5432 >/dev/null
  base_pg_ip=$(kubectl_at "$base_kubeconfig" "$base_context" get pod/error-tracking-postgres-0 -o jsonpath='{.status.podIP}')
  isolation_result=$(kubectl_at "$kubeconfig" "$context" exec pod/error-tracking-postgres-0 -- sh -c \
    'pg_isready -h "$1" -p 5432 -t 3 >/dev/null 2>&1; printf "%s" "$?"' sh "$base_pg_ip")
  [ "$isolation_result" = 2 ] || { echo "base PostgreSQL isolation returned $isolation_result" >&2; exit 1; }
  printf '%s\n' 'own_postgres_reachable=pass' 'base_postgres_unreachable=pass' >>"$evidence"

  base_active="base-while-$cluster-active-$(date +%s)"
  [ "$(login_at "$base_kubeconfig" "$base_context" grafana-11)" = 200 ]
  [ "$(plugin_post_status "$base_kubeconfig" "$base_context" grafana-11 "$base_active")" = 200 ]
  assert_contains "$(plugin_body "$base_kubeconfig" "$base_context" grafana-11)" "$base_active"
  secondary_scaled_down=1
  kubectl_at "$kubeconfig" "$context" scale deployment/error-tracking-apiserver --replicas=0 >/dev/null
  kubectl_at "$kubeconfig" "$context" wait --for=delete pod -l app=error-tracking-apiserver --timeout=180s >/dev/null
  [ "$(kubectl_at "$kubeconfig" "$context" exec pod/error-tracking-proof -- curl --connect-timeout 2 --max-time 5 -sS -o /dev/null -w '%{http_code}' http://grafana-11:3000/api/health)" = 200 ]
  [ -z "$(kubectl_at "$kubeconfig" "$context" get endpoints api -o jsonpath='{.subsets[*].addresses[*].ip}')" ]
  secondary_status=$(kubectl_at "$kubeconfig" "$context" exec pod/error-tracking-proof -- sh -ec \
    'curl --connect-timeout 2 --max-time 10 -sS -b /tmp/grafana-11.cookies -c /tmp/grafana-11.cookies -o /tmp/down -w "%{http_code}" http://grafana-11:3000/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events || true')
  case "$secondary_status" in 000|502|503|504) ;; *) echo "secondary API outage returned $secondary_status" >&2; exit 1 ;; esac
  base_outage="base-while-$cluster-api-down-$(date +%s)"
  [ "$(plugin_post_status "$base_kubeconfig" "$base_context" grafana-11 "$base_outage")" = 200 ]
  base_body=$(plugin_body "$base_kubeconfig" "$base_context" grafana-11)
  assert_contains "$base_body" "$base_active"; assert_contains "$base_body" "$base_outage"
  [ "$(postgres_at "$kubeconfig" "$context" "SELECT count(*) FROM error_tracking_event WHERE message IN ('$base_active','$base_outage')")" = 0 ]
  kubectl_at "$kubeconfig" "$context" scale deployment/error-tracking-apiserver --replicas=2 >/dev/null
  kubectl_at "$kubeconfig" "$context" rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
  secondary_scaled_down=0
  printf 'base_read_write_while_secondary_active_and_api_down=pass secondary_status=%s\n' "$secondary_status" >>"$evidence"

  kubectl_at "$kubeconfig" "$context" rollout restart statefulset/error-tracking-postgres >/dev/null
  kubectl_at "$kubeconfig" "$context" rollout status statefulset/error-tracking-postgres --timeout=300s >/dev/null
  attempts=0
  while :; do
    body11=$(plugin_body "$kubeconfig" "$context" grafana-11 2>/dev/null || true)
    body22=$(plugin_body "$kubeconfig" "$context" grafana-22 2>/dev/null || true)
    case "$body11:$body22" in *"$marker11"*"$marker22"*) break ;; esac
    attempts=$((attempts + 1)); [ "$attempts" -lt 60 ] || { echo 'markers unavailable after PostgreSQL restart' >&2; exit 1; }; sleep 2
  done
  printf '%s\n' 'postgres_restart_persistence_via_plugin=pass' >>"$evidence"

  previous_password=$password previous_ca=$ca previous_jwks=$jwks previous_marker11=$marker11 previous_marker22=$marker22
  trap - EXIT INT TERM
  cleanup_environment
}

run_environment error-tracking-native-cell-b error-tracking-native-cell-b-net 10.247.0.0/16 10.114.0.0/16
run_environment error-tracking-native-byoc error-tracking-native-byoc-net 10.248.0.0/16 10.115.0.0/16
printf '%s\n' 'native multi-environment proof passed'
