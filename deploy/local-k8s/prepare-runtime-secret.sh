#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
KUBECONFIG=${KUBECONFIG:-"$ROOT_DIR/.local-kubeconfig"}
KUBE_CONTEXT=${KUBE_CONTEXT:-kind-error-tracking-native}
NAMESPACE=${NAMESPACE:-error-tracking}
SECRET_NAME=${SECRET_NAME:-error-tracking-runtime}
KUBECTL_BIN=${KUBECTL_BIN:-kubectl}

case "$KUBE_CONTEXT" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local kube context: $KUBE_CONTEXT" >&2; exit 1 ;;
esac
[ "$NAMESPACE" = error-tracking ] || { echo 'this helper requires namespace error-tracking' >&2; exit 1; }

secret=$("$KUBECTL_BIN" --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" \
  get secret "$SECRET_NAME" --ignore-not-found -o name)
if [ -n "$secret" ]; then
  password_b64=$("$KUBECTL_BIN" --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" \
    get secret "$SECRET_NAME" -o jsonpath='{.data.password}')
  [ -n "$password_b64" ] || { echo "existing Secret $SECRET_NAME has no password" >&2; exit 1; }
  runtime_password=$(printf '%s' "$password_b64" | docker run --rm -i alpine:3.22 base64 -d)
else
  runtime_password=$(docker run --rm alpine:3.22 sh -c "dd if=/dev/urandom bs=24 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n'")
fi

"$KUBECTL_BIN" --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" apply -f - >/dev/null <<EOF_SECRET
apiVersion: v1
kind: Secret
metadata:
  name: $SECRET_NAME
  namespace: $NAMESPACE
type: Opaque
stringData:
  password: $runtime_password
  username: error_tracking_runtime
  endpoint: error-tracking-postgres
  port: "5432"
EOF_SECRET
