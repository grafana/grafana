#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
kubeconfig=${KUBECONFIG:-"$root/.local-kubeconfig"}
context=${KUBE_CONTEXT:?set KUBE_CONTEXT to an isolated local kind context}
namespace=${NAMESPACE:-error-tracking}
python_bin=${PYTHON_BIN:-/opt/homebrew/bin/python3.13}
kubectl_bin=${KUBECTL_BIN:-kubectl}

case "$context" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local kube context: $context" >&2; exit 1 ;;
esac
[ "$namespace" = error-tracking ] || { echo 'this helper requires namespace error-tracking' >&2; exit 1; }

kubectl_local() {
  "$kubectl_bin" --kubeconfig "$kubeconfig" --context "$context" -n "$namespace" "$@"
}

old_secret=$(mktemp "${TMPDIR:-/tmp}/error-tracking-runtime.XXXXXX.json")
new_secret=$(mktemp "${TMPDIR:-/tmp}/error-tracking-runtime-rotated.XXXXXX.json")
restore_secret=$(mktemp "${TMPDIR:-/tmp}/error-tracking-runtime-restore.XXXXXX.json")
secret_changed=0
cleanup() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$secret_changed" = 1 ]; then
    set +e
    kubectl_local apply -f "$restore_secret" >/dev/null \
      && KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" NAMESPACE="$namespace" \
        "$root/deploy/local-k8s/run-migration.sh" >/dev/null \
      && kubectl_local rollout restart deployment/error-tracking-apiserver >/dev/null \
      && kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
    recovered=$?
    set -e
    if [ "$recovered" -ne 0 ]; then
      printf 'rotation recovery failed; prior Secret backup retained at %s\n' "$restore_secret" >&2
      rm -f "$old_secret" "$new_secret"
      return "$status"
    fi
    printf '%s\n' 'rotation failed; prior Secret, database role, and API deployment restored' >&2
  fi
  rm -f "$old_secret" "$new_secret" "$restore_secret"
  return "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

kubectl_local get secret error-tracking-runtime -o json >"$old_secret"
new_password=$(openssl rand -hex 24)
NEW_RUNTIME_PASSWORD="$new_password" "$python_bin" - "$old_secret" "$new_secret" "$restore_secret" <<'PY'
import base64
import copy
import json
import os
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    secret = json.load(source)

def clean(value):
    value = copy.deepcopy(value)
    metadata = value["metadata"]
    for key in ("creationTimestamp", "managedFields", "resourceVersion", "uid"):
        metadata.pop(key, None)
    metadata.pop("annotations", None)
    return value

with open(sys.argv[3], "w", encoding="utf-8") as destination:
    json.dump(clean(secret), destination)

password = os.environ["NEW_RUNTIME_PASSWORD"]
rotated = clean(secret)
data = rotated.setdefault("data", {})
encode = lambda value: base64.b64encode(value.encode()).decode()
data["password"] = encode(password)
data.pop("database_url", None)
with open(sys.argv[2], "w", encoding="utf-8") as destination:
    json.dump(rotated, destination)
PY
kubectl_local apply -f "$new_secret" >/dev/null
secret_changed=1

KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" NAMESPACE="$namespace" \
  "$root/deploy/local-k8s/run-migration.sh" >/dev/null
kubectl_local rollout restart deployment/error-tracking-apiserver >/dev/null
kubectl_local rollout status deployment/error-tracking-apiserver --timeout=300s >/dev/null
KUBECONFIG="$kubeconfig" KUBE_CONTEXT="$context" NAMESPACE="$namespace" \
  "$root/deploy/local-k8s/prove-privileges.sh" >/dev/null
printf '%s\n' 'runtime database credential rotated; API rollout complete'
