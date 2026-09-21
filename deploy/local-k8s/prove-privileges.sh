#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
KUBECONFIG=${KUBECONFIG:-"$ROOT_DIR/.local-kubeconfig"}
KUBE_CONTEXT=${KUBE_CONTEXT:?set KUBE_CONTEXT to an isolated local kind context}
NAMESPACE=${NAMESPACE:-error-tracking}
POD=${POD:-error-tracking-postgres-0}
KUBECTL_BIN=${KUBECTL_BIN:-kubectl}

kubectl_local() {
  "$KUBECTL_BIN" --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" "$@"
}

case "$KUBE_CONTEXT" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local kube context: $KUBE_CONTEXT" >&2; exit 1 ;;
esac
if [ "$NAMESPACE" != error-tracking ]; then
  echo "this proof requires namespace error-tracking" >&2
  exit 1
fi

password=$(kubectl_local get secret error-tracking-runtime -o jsonpath='{.data.password}' | docker run --rm -i alpine:3.22 base64 -d)
psql() {
  printf '%s\n' "$password" |
    kubectl_local exec -i "$POD" -- sh -c 'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -h error-tracking-postgres -U error_tracking_runtime -d error_tracking "$@"' -- "$@"
}

marker="privilege-proof-$(date +%s)"
result=$(psql -v ON_ERROR_STOP=1 -At -c "BEGIN; SELECT current_user; INSERT INTO error_tracking_event (created_at, occurred_at, tenant_namespace, project, message, created_by, source_ip) VALUES ((extract(epoch FROM clock_timestamp()) * 1000)::bigint, (extract(epoch FROM clock_timestamp()) * 1000)::bigint, 'privilege-proof', '$marker', 'runtime DML works', 'proof', '127.0.0.1'); SELECT project FROM error_tracking_event WHERE project='$marker'; ROLLBACK;")
printf '%s\n' "$result" | grep -Fxq error_tracking_runtime
printf '%s\n' "$result" | grep -Fxq "$marker"

expect_denied() {
  sql=$1
  output=$(mktemp)
  if psql -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -c "$sql" >"$output" 2>&1; then
    rm -f "$output"
    echo "runtime role unexpectedly succeeded: $sql" >&2
    exit 1
  fi
  grep -Fq '42501' "$output"
  rm -f "$output"
}

expect_denied "BEGIN; CREATE TABLE privilege_should_fail(id integer); ROLLBACK;"
expect_denied "BEGIN; ALTER TABLE error_tracking_event ADD COLUMN privilege_should_fail text; ROLLBACK;"
expect_denied "BEGIN; DROP TABLE error_tracking_event; ROLLBACK;"
expect_denied "BEGIN; UPDATE error_tracking_event SET message = 'privilege should fail' WHERE project = '$marker'; ROLLBACK;"
expect_denied "BEGIN; DELETE FROM error_tracking_event WHERE project = '$marker'; ROLLBACK;"
expect_denied "BEGIN; TRUNCATE TABLE error_tracking_event; ROLLBACK;"
printf '%s\n' 'runtime role SELECT/INSERT passed; UPDATE/DELETE/TRUNCATE/CREATE/ALTER/DROP denied'
