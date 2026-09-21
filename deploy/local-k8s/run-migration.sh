#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
KUBECONFIG=${KUBECONFIG:-"$ROOT_DIR/.local-kubeconfig"}
KUBE_CONTEXT=${KUBE_CONTEXT:-kind-error-tracking-native}
NAMESPACE=${NAMESPACE:-error-tracking}
export KUBECONFIG KUBE_CONTEXT NAMESPACE

case "$KUBE_CONTEXT" in
  kind-error-tracking-native|kind-error-tracking-native-*) ;;
  *) echo "refusing non-local kube context: $KUBE_CONTEXT" >&2; exit 1 ;;
esac
if [ "$NAMESPACE" != error-tracking ]; then
  echo "this local manifest set requires namespace error-tracking" >&2
  exit 1
fi
kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" create namespace "$NAMESPACE" --dry-run=client -o yaml |
  kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" apply -f - >/dev/null
"$ROOT_DIR/deploy/local-k8s/prepare-runtime-secret.sh"
kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" delete job error-tracking-migrate --ignore-not-found >/dev/null
API_IMAGE=${API_IMAGE:-error-tracking-api:local}
sed "s|image: error-tracking-api:local|image: $API_IMAGE|" "$ROOT_DIR/deploy/local-k8s/migrations.yaml" |
  kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" apply -f - >/dev/null
kubectl --kubeconfig "$KUBECONFIG" --context "$KUBE_CONTEXT" -n "$NAMESPACE" wait --for=condition=complete job/error-tracking-migrate --timeout=180s
