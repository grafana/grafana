#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
kind_bin=${KIND_BIN:-/Users/inanc/grafana/.local-bin/kind}
kubectl_bin=${KUBECTL_BIN:-kubectl}
python_bin=${PYTHON_BIN:-/opt/homebrew/bin/python3.13}
platform_image=${PLATFORM_IMAGE:-error-tracking-platform:local}
api_image=${API_IMAGE:-error-tracking-api:local}
signer_image=${SIGNER_IMAGE:-error-tracking-auth-signer:local}
enterprise_source=${ENTERPRISE_SOURCE:-/Users/inanc/grafana/grafana-enterprise-error-tracking}
evidence_dir=${EVIDENCE_DIR:-/tmp/error-tracking-native-multienv}
base_evidence=${BASE_EVIDENCE_FILE:-/tmp/error-tracking-native-evidence.txt}
base_kubeconfig=${BASE_KUBECONFIG:-/tmp/error-tracking-native.kubeconfig}
base_context=${BASE_CONTEXT:-kind-error-tracking-native}
previous_password_hash=
previous_marker11=
previous_marker22=
forward_pids=
mkdir -p "$evidence_dir"

case "$base_context" in
  kind-error-tracking-native) ;;
  *) echo "refusing non-base local context: $base_context" >&2; exit 1 ;;
esac

password_hash() {
  "$kubectl_bin" --kubeconfig "$1" --context "$2" -n error-tracking get secret error-tracking-runtime -o json |
    "$python_bin" -c 'import base64,hashlib,json,sys; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)["data"]["password"])).hexdigest())'
}

postgres_exec_at() {
  kubeconfig_arg=$1
  context_arg=$2
  sql_arg=$3
  "$kubectl_bin" --kubeconfig "$kubeconfig_arg" --context "$context_arg" -n error-tracking \
    exec statefulset/error-tracking-postgres -- env PGPASSWORD=local-only-password \
    psql -h 127.0.0.1 -U error_tracking -d error_tracking -v ON_ERROR_STOP=1 -Atc "$sql_arg"
}

base_record() {
  awk -F= -v key="$1" '$1 == key {print substr($0, length(key) + 2); exit}' "$base_evidence"
}

assert_single_line() {
  [ -n "$1" ]
  [ "$(printf '%s\n' "$1" | wc -l | tr -d ' ')" = 1 ]
}

assert_not_in_lines() {
  needle=$1
  lines=$2
  ! printf '%s\n' "$lines" | grep -Fxq "$needle"
}

wait_http() {
  url=$1
  attempt=0
  until curl --connect-timeout 2 --max-time 5 -fsS "$url" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 60 ] || { echo "timed out waiting for $url" >&2; exit 1; }
    sleep 2
  done
}

start_forward() {
  kubeconfig_arg=$1
  context_arg=$2
  resource_arg=$3
  ports_arg=$4
  log_arg=$5
  "$kubectl_bin" --kubeconfig "$kubeconfig_arg" --context "$context_arg" -n error-tracking \
    port-forward "$resource_arg" "$ports_arg" >"$log_arg" 2>&1 &
  forward_pid=$!
  forward_pids="$forward_pids $forward_pid"
  sleep 1
  kill -0 "$forward_pid" 2>/dev/null || {
    cat "$log_arg" >&2
    echo "failed to start port-forward $resource_arg $ports_arg" >&2
    exit 1
  }
}

stop_forwards() {
  for forward_pid in $forward_pids; do
    kill "$forward_pid" 2>/dev/null || true
    wait "$forward_pid" 2>/dev/null || true
  done
  forward_pids=
}

[ -r "$base_evidence" ] && [ -r "$base_kubeconfig" ]
baseline_image_id=$(base_record api_config_image_id)
baseline_runtime_image_id=$(base_record runtime_image_id)
baseline_binary_hash=$(base_record api_binary_sha256)
baseline_password_hash=$(password_hash "$base_kubeconfig" "$base_context")
base_markers=$(postgres_exec_at "$base_kubeconfig" "$base_context" \
  "select message from error_tracking_event where project = 'native-local' order by message;")
[ -n "$baseline_image_id" ]
[ -n "$baseline_runtime_image_id" ]
[ -n "$baseline_binary_hash" ]
[ -n "$baseline_password_hash" ]
[ -n "$base_markers" ]

run_environment() {
  cluster=$1
  network=$2
  pod_subnet=$3
  service_subnet=$4
  kubeconfig="$evidence_dir/$cluster.kubeconfig"
  evidence="$evidence_dir/$cluster-evidence.txt"
  context="kind-$cluster"
  cookie11="$evidence_dir/$cluster-stack-11.cookies"
  cookie22="$evidence_dir/$cluster-stack-22.cookies"
  response11="$evidence_dir/$cluster-stack-11-after-postgres-restart.json"
  response22="$evidence_dir/$cluster-stack-22-after-postgres-restart.json"
  base_cookie="$evidence_dir/$cluster-base-stack-11.cookies"
  forward_pids=

  "$kind_bin" get clusters | grep -Fxq "$cluster" && {
    echo "refusing pre-existing disposable cluster: $cluster" >&2
    exit 1
  }
  if docker network inspect "$network" >/dev/null 2>&1; then
    echo "refusing pre-existing disposable network: $network" >&2
    exit 1
  fi
  rm -f "$kubeconfig" "$evidence" "$cookie11" "$cookie22" "$base_cookie" "$response11" "$response22"
  docker network create "$network" >/dev/null
  cleanup() {
    stop_forwards
    "$kind_bin" delete cluster --name "$cluster" >/dev/null 2>&1 || true
    cleanup_attempt=0
    while docker network inspect "$network" >/dev/null 2>&1; do
      docker network rm "$network" >/dev/null 2>&1 || true
      cleanup_attempt=$((cleanup_attempt + 1))
      [ "$cleanup_attempt" -lt 10 ] || break
      sleep 1
    done
  }
  trap cleanup EXIT INT TERM

  NATIVE_CLUSTER_NAME="$cluster" \
  KUBECONFIG="$kubeconfig" \
  EVIDENCE_FILE="$evidence" \
  PLATFORM_IMAGE="$platform_image" \
  API_IMAGE="$api_image" \
  SIGNER_IMAGE="$signer_image" \
  ENTERPRISE_SOURCE="$enterprise_source" \
  NATIVE_DOCKER_NETWORK="$network" \
  NATIVE_POD_SUBNET="$pod_subnet" \
  NATIVE_SERVICE_SUBNET="$service_subnet" \
    "$root/deploy/local-k8s/prove-native.sh"

  grep -Fxq 'helper_exit=success' "$evidence"
  grep -Fxq 'runtime_role_privileges=pass' "$evidence"

  image_id=$(docker image inspect "$api_image" --format '{{.Id}}')
  binary_hash=$("$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    exec deployment/error-tracking-apiserver -- sha256sum /usr/local/bin/error-tracking | awk '{print $1}')
  runtime_image_id=$("$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    get pod -l app=error-tracking-apiserver -o jsonpath='{.items[0].status.containerStatuses[0].imageID}')
  password_hash_value=$(password_hash "$kubeconfig" "$context")
  [ -n "$image_id" ] && [ -n "$runtime_image_id" ] && [ -n "$binary_hash" ] && [ -n "$password_hash_value" ]
  [ "$image_id" = "$baseline_image_id" ]
  [ "$runtime_image_id" = "$baseline_runtime_image_id" ]
  [ "$binary_hash" = "$baseline_binary_hash" ]
  [ "$password_hash_value" != "$baseline_password_hash" ]
  [ -z "$previous_password_hash" ] || [ "$password_hash_value" != "$previous_password_hash" ]
  printf '%s\n' \
    'base_image_and_binary_match=pass' \
    'runtime_password_unique=pass' >>"$evidence"

  marker11=$(postgres_exec_at "$kubeconfig" "$context" \
    "select message from error_tracking_event where tenant_namespace = 'stacks-11' and project = 'native-local' and message like '$cluster-stack-11-%';")
  marker22=$(postgres_exec_at "$kubeconfig" "$context" \
    "select message from error_tracking_event where tenant_namespace = 'stacks-22' and project = 'native-local' and message like '$cluster-stack-22-%';")
  assert_single_line "$marker11"
  assert_single_line "$marker22"
  assert_not_in_lines "$marker11" "$base_markers"
  assert_not_in_lines "$marker22" "$base_markers"
  [ -z "$previous_marker11" ] || [ "$marker11" != "$previous_marker11" ]
  [ -z "$previous_marker22" ] || [ "$marker22" != "$previous_marker22" ]
  [ "$(postgres_exec_at "$kubeconfig" "$context" \
    "select count(*) from error_tracking_event where project = 'native-local' and message not in ('$marker11', '$marker22');")" = 0 ]
  [ "$(postgres_exec_at "$kubeconfig" "$context" \
    "select count(*) from error_tracking_event where tenant_namespace = 'stacks-11' and message = '$marker22';")" = 0 ]
  [ "$(postgres_exec_at "$kubeconfig" "$context" \
    "select count(*) from error_tracking_event where tenant_namespace = 'stacks-22' and message = '$marker11';")" = 0 ]
  printf 'environment_markers=pass stack11=%s stack22=%s\n' "$marker11" "$marker22" >>"$evidence"

  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    exec statefulset/error-tracking-postgres -- pg_isready -h error-tracking-postgres -p 5432 >/dev/null
  printf 'own_postgres_reachable=pass\n' >>"$evidence"

  base_pod_ip=$("$kubectl_bin" --kubeconfig "$base_kubeconfig" --context "$base_context" -n error-tracking \
    get pod -l app=error-tracking-postgres -o jsonpath='{.items[0].status.podIP}')
  base_probe_result=$("$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    exec statefulset/error-tracking-postgres -- sh -c \
    "pg_isready -h \"\$1\" -p 5432 -t 3 >/dev/null 2>&1; code=\$?; printf 'pg_isready_exit=%s\\n' \"\$code\"" sh "$base_pod_ip")
  [ "$base_probe_result" = 'pg_isready_exit=2' ] || {
    echo "base PostgreSQL isolation probe returned: $base_probe_result" >&2
    exit 1
  }
  printf 'base_postgres_unreachable=pass\n' >>"$evidence"

  start_forward "$kubeconfig" "$context" service/st-grafana-11 3311:3000 "$evidence_dir/$cluster-forward-3311.log"
  secondary_forward11_pid=$forward_pid
  start_forward "$kubeconfig" "$context" service/st-grafana-22 3322:3000 "$evidence_dir/$cluster-forward-3322.log"
  secondary_forward22_pid=$forward_pid
  wait_http http://127.0.0.1:3311/api/health
  wait_http http://127.0.0.1:3322/api/health
  curl --connect-timeout 2 --max-time 10 -fsS -c "$cookie11" -H 'Content-Type: application/json' \
    --data '{"user":"admin","password":"admin"}' http://127.0.0.1:3311/login >/dev/null
  curl --connect-timeout 2 --max-time 10 -fsS -c "$cookie22" -H 'Content-Type: application/json' \
    --data '{"user":"admin","password":"admin"}' http://127.0.0.1:3322/login >/dev/null

  start_forward "$base_kubeconfig" "$base_context" service/st-grafana-11 3412:3000 "$evidence_dir/$cluster-base-forward-3412.log"
  wait_http http://127.0.0.1:3412/api/health
  curl --connect-timeout 2 --max-time 10 -fsS -c "$base_cookie" -H 'Content-Type: application/json' \
    --data '{"user":"admin","password":"admin"}' http://127.0.0.1:3412/login >/dev/null
  base_events=http://127.0.0.1:3412/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events
  base_active_marker="base-while-$cluster-active-$(date +%s)"
  curl --connect-timeout 2 --max-time 10 -fsS -b "$base_cookie" -H 'Content-Type: application/json' \
    --data "{\"project\":\"multienv-concurrency\",\"message\":\"$base_active_marker\"}" "$base_events" >/dev/null
  base_body=$(curl --connect-timeout 2 --max-time 10 -fsS -b "$base_cookie" "$base_events")
  printf '%s' "$base_body" | MARKER="$base_active_marker" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(sys.stdin)["items"])'

  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    scale deployment/error-tracking-apiserver --replicas=0 >/dev/null
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    wait --for=delete pod -l app=error-tracking-apiserver --timeout=180s >/dev/null
  secondary_status=$(curl --connect-timeout 2 --max-time 10 -sS -o /dev/null -w '%{http_code}' -b "$cookie11" \
    http://127.0.0.1:3311/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events || true)
  case "$secondary_status" in 000|502|503|504) ;; *) echo "secondary API outage returned $secondary_status" >&2; exit 1 ;; esac
  base_outage_marker="base-while-$cluster-api-down-$(date +%s)"
  curl --connect-timeout 2 --max-time 10 -fsS -b "$base_cookie" -H 'Content-Type: application/json' \
    --data "{\"project\":\"multienv-concurrency\",\"message\":\"$base_outage_marker\"}" "$base_events" >/dev/null
  base_body=$(curl --connect-timeout 2 --max-time 10 -fsS -b "$base_cookie" "$base_events")
  printf '%s' "$base_body" | ACTIVE="$base_active_marker" OUTAGE="$base_outage_marker" "$python_bin" -c 'import json,os,sys; messages={x["message"] for x in json.load(sys.stdin)["items"]}; assert {os.environ["ACTIVE"], os.environ["OUTAGE"]} <= messages'
  [ "$(postgres_exec_at "$kubeconfig" "$context" "select count(*) from error_tracking_event where message in ('$base_active_marker', '$base_outage_marker');")" = 0 ]
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    scale deployment/error-tracking-apiserver --replicas=2 >/dev/null
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
  printf 'base_read_write_while_secondary_active_and_api_down=pass secondary_status=%s\n' "$secondary_status" >>"$evidence"

  # Refresh local forwards after the outage test before checking PostgreSQL recovery.
  kill "$secondary_forward11_pid" "$secondary_forward22_pid" 2>/dev/null || true
  start_forward "$kubeconfig" "$context" service/st-grafana-11 3311:3000 "$evidence_dir/$cluster-forward-3311-recovery.log"
  start_forward "$kubeconfig" "$context" service/st-grafana-22 3322:3000 "$evidence_dir/$cluster-forward-3322-recovery.log"
  wait_http http://127.0.0.1:3311/api/health
  wait_http http://127.0.0.1:3322/api/health

  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    rollout restart statefulset/error-tracking-postgres >/dev/null
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n error-tracking \
    rollout status statefulset/error-tracking-postgres --timeout=180s >/dev/null
  attempt=0
  until curl --connect-timeout 2 --max-time 10 -fsS -b "$cookie11" \
      http://127.0.0.1:3311/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events >"$response11" 2>/dev/null \
    && MARKER="$marker11" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(open(sys.argv[1]))["items"])' "$response11" 2>/dev/null; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 60 ] || { echo 'stack 11 marker unavailable after PostgreSQL restart' >&2; exit 1; }
    sleep 2
  done
  attempt=0
  until curl --connect-timeout 2 --max-time 10 -fsS -b "$cookie22" \
      http://127.0.0.1:3322/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-22/events >"$response22" 2>/dev/null \
    && MARKER="$marker22" "$python_bin" -c 'import json,os,sys; assert any(x["message"] == os.environ["MARKER"] for x in json.load(open(sys.argv[1]))["items"])' "$response22" 2>/dev/null; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 60 ] || { echo 'stack 22 marker unavailable after PostgreSQL restart' >&2; exit 1; }
    sleep 2
  done
  printf 'postgres_restart_persistence_via_api=pass\n' >>"$evidence"

  previous_password_hash=$password_hash_value
  previous_marker11=$marker11
  previous_marker22=$marker22
  trap - EXIT INT TERM
  cleanup
}

run_environment error-tracking-native-cell-b error-tracking-native-cell-b-net 10.247.0.0/16 10.114.0.0/16
run_environment error-tracking-native-byoc error-tracking-native-byoc-net 10.248.0.0/16 10.115.0.0/16
printf 'native multi-environment proof passed\n'
