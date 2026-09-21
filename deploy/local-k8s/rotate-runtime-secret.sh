#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
kubeconfig=${KUBECONFIG:-"$root/.local-kubeconfig"}
context=${KUBE_CONTEXT:?set KUBE_CONTEXT to an isolated local kind context}
namespace=${NAMESPACE:-error-tracking}
kubectl_bin=${KUBECTL_BIN:-kubectl}
secret_changed=0

case "$context" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local kube context: $context" >&2; exit 1 ;;
esac
[ "$namespace" = error-tracking ] || { echo 'this helper requires namespace error-tracking' >&2; exit 1; }

kubectl_local() {
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n "$namespace" "$@"
}
decode() { docker run --rm -i alpine:3.22 base64 -d; }
encode() { docker run --rm -i alpine:3.22 base64 | tr -d '\n'; }
random_password() {
  docker run --rm alpine:3.22 sh -c "dd if=/dev/urandom bs=24 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n'"
}
runtime_psql() {
  password=$1
  shift
  printf '%s\n' "$password" | kubectl_local exec -i pod/error-tracking-postgres-0 -- \
    sh -c 'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -h error-tracking-postgres -U error_tracking_runtime -d error_tracking "$@"' -- "$@"
}

old_password_b64=$(kubectl_local get secret error-tracking-runtime -o jsonpath='{.data.password}')
[ -n "$old_password_b64" ] || { echo 'runtime Secret has no password' >&2; exit 1; }
old_password=$(printf '%s' "$old_password_b64" | decode)
row_count_before=$(runtime_psql "$old_password" -v ON_ERROR_STOP=1 -Atc 'SELECT count(*) FROM error_tracking_event')

restore() {
  status=$?
  [ -z "${old_attempt:-}" ] || rm -f "$old_attempt"
  if [ "$status" -ne 0 ] && [ "$secret_changed" = 1 ]; then
    set +e
    kubectl_local patch secret error-tracking-runtime --type=merge \
      -p "{\"data\":{\"password\":\"$old_password_b64\"}}" >/dev/null \
      && KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" NAMESPACE="$namespace" KUBECTL_BIN="$kubectl_bin" \
        "$root/deploy/local-k8s/run-migration.sh" >/dev/null \
      && kubectl_local rollout restart deployment/error-tracking-apiserver >/dev/null \
      && kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
    recovered=$?
    set -e
    if [ "$recovered" -eq 0 ]; then
      echo 'rotation failed; prior Secret, database role, and API deployment restored' >&2
    else
      echo 'rotation recovery failed; restore the runtime Secret and rerun the migration Job' >&2
    fi
  fi
  exit "$status"
}
trap restore EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

new_password=$(random_password)
new_password_b64=$(printf '%s' "$new_password" | encode)
kubectl_local patch secret error-tracking-runtime --type=merge \
  -p "{\"data\":{\"password\":\"$new_password_b64\"}}" >/dev/null
secret_changed=1

if ! KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" NAMESPACE="$namespace" KUBECTL_BIN="$kubectl_bin" \
  "$root/deploy/local-k8s/run-migration.sh" >/dev/null; then
  echo 'migration failed after runtime credential update' >&2
  exit 1
fi
kubectl_local rollout restart deployment/error-tracking-apiserver >/dev/null
if ! kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null; then
  echo 'API rollout failed after runtime credential update' >&2
  exit 1
fi

if ! row_count_after=$(runtime_psql "$new_password" -v ON_ERROR_STOP=1 -Atc 'SELECT count(*) FROM error_tracking_event'); then
  echo 'new runtime credential did not authenticate' >&2
  exit 1
fi
[ "$row_count_after" = "$row_count_before" ] || { echo 'event count changed during credential rotation' >&2; exit 1; }
old_attempt=$(mktemp "${TMPDIR:-/tmp}/error-tracking-old-password.XXXXXX")
if runtime_psql "$old_password" -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -Atc 'SELECT 1' >"$old_attempt" 2>&1; then
  rm -f "$old_attempt"
  echo 'old runtime credential still authenticates' >&2
  exit 1
fi
if ! grep -Fq 'FATAL:  password authentication failed for user "error_tracking_runtime"' "$old_attempt"; then
  echo 'old runtime credential did not fail with the expected PostgreSQL authentication error' >&2
  exit 1
fi
rm -f "$old_attempt"

if ! KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" NAMESPACE="$namespace" KUBECTL_BIN="$kubectl_bin" \
  "$root/deploy/local-k8s/prove-privileges.sh" >/dev/null; then
  echo 'runtime privilege proof failed after credential rotation' >&2
  exit 1
fi
secret_changed=0
trap - EXIT INT TERM
printf '%s\n' 'runtime database credential rotated; new credential works, old credential is rejected, and existing data is unchanged'
