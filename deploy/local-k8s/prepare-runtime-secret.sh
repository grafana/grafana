#!/bin/sh
set -eu

KUBECONFIG=${KUBECONFIG:-"$(pwd)/.local-kubeconfig"}
KUBE_CONTEXT=${KUBE_CONTEXT:-kind-error-tracking-native}
NAMESPACE=${NAMESPACE:-error-tracking}
SECRET_NAME=${SECRET_NAME:-error-tracking-runtime}

case "$KUBE_CONTEXT" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local kube context: $KUBE_CONTEXT" >&2; exit 1 ;;
esac
[ "$NAMESPACE" = error-tracking ] || { echo 'this helper requires namespace error-tracking' >&2; exit 1; }

secret=$(kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" \
  get secret "$SECRET_NAME" --ignore-not-found -o name)
if [ -n "$secret" ]; then
  password_b64=$(kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" \
    get secret "$SECRET_NAME" -o jsonpath='{.data.password}')
  [ -n "$password_b64" ] || { echo "existing Secret $SECRET_NAME has no password" >&2; exit 1; }
  runtime_password=$(printf '%s' "$password_b64" | base64 -d)
else
  runtime_password=$(openssl rand -hex 24)
fi
b64() { printf '%s' "$1" | base64 | tr -d '\n'; }

kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" apply -f - >/dev/null <<EOF_SECRET
apiVersion: v1
kind: Secret
metadata:
  name: $SECRET_NAME
  namespace: $NAMESPACE
type: Opaque
data:
  password: $(b64 "$runtime_password")
  username: $(b64 error_tracking_app)
  endpoint: $(b64 error-tracking-postgres)
  port: $(b64 5432)
EOF_SECRET
