#!/usr/bin/env bash
#
# Backfill default folder ResourcePermissions for Git Sync root folders affected by
# incident i-2026-07-09-mt-folder-service-cannot-create-default-permissions.
#
# Implements scripts/backfill-folder-default-permissions/backfill.md:
#   - ingest TSV (stack_id, cluster)
#   - discover repositories + root folders via the Provisioning app API
#   - create missing iam.grafana.app/v0alpha1/resourcepermissions (idempotent)
#
# SAFETY: dry-run is the default. Pass --execute to perform writes.
# Do not run against production until the script has been reviewed.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- defaults (override via env) ---
DRY_RUN="${DRY_RUN:-1}"
TSV_FILE="${TSV_FILE:-}"
CLUSTER_FILTER="${CLUSTER_FILTER:-}"
STACK_FILTER="${STACK_FILTER:-}"
LIMIT="${LIMIT:-0}"
VERBOSE="${VERBOSE:-0}"

KUBE_CONTEXT_PREFIX="${KUBE_CONTEXT_PREFIX:-}"

GRAFANA_APPS_NS="${GRAFANA_APPS_NS:-grafana-apps}"
GRAFANA_FOLDER_NS="${GRAFANA_FOLDER_NS:-grafana-folder}"
GRAFANA_IAM_NS="${GRAFANA_IAM_NS:-grafana-iam}"
AUTH_NS="${AUTH_NS:-auth}"

# Leave unset to auto-detect: prod uses *-{cluster}, dev/ops use *-system-cap.
PROVISIONING_CAP_SECRET="${PROVISIONING_CAP_SECRET:-}"
FOLDER_CAP_SECRET="${FOLDER_CAP_SECRET:-}"

CLUSTER_PROVISIONING_CAP=""
CLUSTER_FOLDER_CAP=""

PROVISIONING_SVC="${PROVISIONING_SVC:-provisioning-grafana-app-main}"
IAM_SVC="${IAM_SVC:-iam-grafana-app-main}"
AUTH_SVC="${AUTH_SVC:-api-lb}"

AUTH_LOCAL_PORT="${AUTH_LOCAL_PORT:-18080}"
PROVISIONING_LOCAL_PORT="${PROVISIONING_LOCAL_PORT:-16443}"
IAM_LOCAL_PORT="${IAM_LOCAL_PORT:-16444}"

TOKEN_EXCHANGE_PATH="${TOKEN_EXCHANGE_PATH:-/v1/sign-access-token}"
GCOM_CMD="${GCOM_CMD:-gcom}"

# counters
declare -i STAT_STACKS=0 STAT_REPOS=0 STAT_ROOT_FOLDERS=0 STAT_EXISTS=0 STAT_WOULD_CREATE=0 STAT_CREATED=0 STAT_ERRORS=0

PF_PIDS=()
PF_LOG_DIR=""

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
vlog() { [[ "${VERBOSE}" == "1" ]] && log "$@" || true; }
warn() { log "WARN: $*" >&2; }
die() { log "ERROR: $*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: $(basename "$0") --tsv <file> [options]

Process stacks from the incident TSV and backfill missing folder default permissions.

Options:
  --tsv PATH           TSV with columns: stack_id, cluster, ...
  --execute            Perform creates (default: dry-run only)
  --cluster NAME       Only process stacks in this cluster (repeatable)
  --stack NAMESPACE    Only process this stack namespace, e.g. stacks-1005291 (repeatable)
  --limit N            Stop after N stacks
  --verbose            Extra logging
  -h, --help           Show this help

Environment:
  DRY_RUN=1            Set to 0 with --execute
  GCOM_CMD             Command used to resolve org IDs (default: gcom)
  KUBE_CONTEXT_PREFIX  Optional prefix for kubectl contexts (e.g. gke_)

The TSV stack_id column is the Kubernetes namespace (e.g. stacks-1005291).
Repositories and root folders are discovered live from the Provisioning API;
the TSV repo list is not used for targeting.

Requires: kubectl, curl, jq
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

parse_args() {
  local clusters=()
  local stacks=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tsv)
        TSV_FILE="${2:-}"
        shift 2
        ;;
      --execute)
        DRY_RUN=0
        shift
        ;;
      --cluster)
        clusters+=("${2:-}")
        shift 2
        ;;
      --stack)
        stacks+=("${2:-}")
        shift 2
        ;;
      --limit)
        LIMIT="${2:-0}"
        shift 2
        ;;
      --verbose)
        VERBOSE=1
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
  done

  [[ -n "${TSV_FILE}" ]] || die "--tsv is required"
  [[ -f "${TSV_FILE}" ]] || die "TSV not found: ${TSV_FILE}"

  if ((${#clusters[@]})); then
    CLUSTER_FILTER="$(
      IFS=,
      echo "${clusters[*]}"
    )"
  fi
  if ((${#stacks[@]})); then
    STACK_FILTER="$(
      IFS=,
      echo "${stacks[*]}"
    )"
  fi
}

kubectl_ctx() {
  local cluster="$1"
  shift
  kubectl --context "${KUBE_CONTEXT_PREFIX}${cluster}" "$@"
}

cleanup() {
  local pid
  if ((${#PF_PIDS[@]})); then
    for pid in "${PF_PIDS[@]}"; do
      kill "${pid}" 2>/dev/null || true
    done
  fi
  if [[ -n "${PF_LOG_DIR}" && -d "${PF_LOG_DIR}" ]]; then
    rm -rf "${PF_LOG_DIR}"
  fi
}

start_port_forward() {
  local cluster="$1"
  local namespace="$2"
  local resource="$3"
  local local_port="$4"
  local remote_port="$5"
  local log_file="${PF_LOG_DIR}/pf-${namespace}-${resource//\//-}-${local_port}.log"

  kubectl_ctx "${cluster}" -n "${namespace}" port-forward "${resource}" "${local_port}:${remote_port}" \
    >"${log_file}" 2>&1 &
  PF_PIDS+=("$!")
  sleep 1
  vlog "port-forward ${namespace}/${resource} -> localhost:${local_port}"
}

wait_for_port() {
  local port="$1"
  local i
  for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null 2>&1 || nc -z 127.0.0.1 "${port}" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done
  die "port-forward not ready on localhost:${port}"
}

cap_secret_name() {
  local cluster="$1"
  local k8s_ns="$2"
  local override="$3"
  local prod_name="$4"
  local dev_name="$5"
  local found

  if [[ -n "${override}" ]]; then
    echo "${override}"
    return 0
  fi

  found="$(kubectl_ctx "${cluster}" -n "${k8s_ns}" get secret "${prod_name}" -o name 2>/dev/null || true)"
  if [[ "${found}" == secret/* ]]; then
    echo "${prod_name}"
    return 0
  fi
  found="$(kubectl_ctx "${cluster}" -n "${k8s_ns}" get secret "${dev_name}" -o name 2>/dev/null || true)"
  if [[ "${found}" == secret/* ]]; then
    echo "${dev_name}"
    return 0
  fi
  die "CAP secret not found in ${k8s_ns} on ${cluster} (tried ${prod_name}, ${dev_name})"
}

resolve_cap_secret_names() {
  local cluster="$1"

  CLUSTER_PROVISIONING_CAP="$(
    cap_secret_name "${cluster}" "${GRAFANA_APPS_NS}" "${PROVISIONING_CAP_SECRET}" \
      "provisioning-connection-operator-${cluster}" "provisioning-connection-operator-system-cap"
  )"
  CLUSTER_FOLDER_CAP="$(
    cap_secret_name "${cluster}" "${GRAFANA_FOLDER_NS}" "${FOLDER_CAP_SECRET}" \
      "folder-grafana-app-main-${cluster}" "folder-grafana-app-main-system-cap"
  )"
  vlog "provisioning CAP secret: ${CLUSTER_PROVISIONING_CAP}"
  vlog "folder CAP secret: ${CLUSTER_FOLDER_CAP}"
}

setup_cluster_port_forwards() {
  local cluster="$1"
  PF_LOG_DIR="$(mktemp -d)"
  resolve_cap_secret_names "${cluster}"
  start_port_forward "${cluster}" "${AUTH_NS}" "svc/${AUTH_SVC}" "${AUTH_LOCAL_PORT}" 80
  start_port_forward "${cluster}" "${GRAFANA_APPS_NS}" "svc/${PROVISIONING_SVC}" "${PROVISIONING_LOCAL_PORT}" 6443
  start_port_forward "${cluster}" "${GRAFANA_IAM_NS}" "svc/${IAM_SVC}" "${IAM_LOCAL_PORT}" 6443
  wait_for_port "${AUTH_LOCAL_PORT}"
  wait_for_port "${PROVISIONING_LOCAL_PORT}"
  wait_for_port "${IAM_LOCAL_PORT}"
}

get_cap_token() {
  local cluster="$1"
  local namespace="$2"
  local secret_name="$3"
  local encoded decoded err

  if ! encoded="$(
    kubectl_ctx "${cluster}" -n "${namespace}" get secret "${secret_name}" \
      -o jsonpath='{.data.token}' 2>&1
  )"; then
    die "failed to read CAP secret ${namespace}/${secret_name} on ${cluster}: ${encoded}"
  fi

  if [[ -z "${encoded}" ]]; then
    die "CAP secret ${namespace}/${secret_name} on ${cluster} has no .data.token field"
  fi

  if ! decoded="$(printf '%s' "${encoded}" | base64 -d 2>&1)"; then
    die "failed to decode CAP secret ${namespace}/${secret_name} on ${cluster}: ${decoded}"
  fi
  printf '%s' "${decoded}"
}

stack_numeric_id() {
  local namespace="$1"
  namespace="${namespace#stacks-}"
  [[ "${namespace}" =~ ^[0-9]+$ ]] || die "invalid stack namespace: stacks-${namespace}"
  echo "${namespace}"
}

resolve_org_id() {
  local namespace="$1"
  local stack_id
  stack_id="$(stack_numeric_id "${namespace}")"

  if command -v "${GCOM_CMD}" >/dev/null 2>&1; then
    local org_id
    org_id="$("${GCOM_CMD}" "/instances/${stack_id}" 2>/dev/null | jq -r '.orgId // empty')"
    if [[ -n "${org_id}" && "${org_id}" != "null" ]]; then
      echo "${org_id}"
      return 0
    fi
    warn "gcom did not return orgId for stack ${stack_id}; falling back to stack id"
  else
    warn "${GCOM_CMD} not found; using stack id as org id (set GCOM_CMD if exchange fails)"
  fi
  echo "${stack_id}"
}

exchange_access_token() {
  local cap_token="$1"
  local namespace="$2"
  local org_id="$3"
  local stack_id="$4"
  shift 4
  local audiences_json
  audiences_json="$(printf '%s\n' "$@" | jq -R . | jq -s .)"

  local realms
  if [[ "${namespace}" == "*" ]]; then
    realms='[{"type":"system","identifier":"system"}]'
  else
    realms="$(jq -nc --arg id "${stack_id}" '[{"type":"stack","identifier":$id}]')"
  fi

  local body
  body="$(jq -nc --arg ns "${namespace}" --argjson aud "${audiences_json}" '{namespace:$ns, audiences:$aud}')"

  curl -sf -X POST \
    -H "Authorization: Bearer ${cap_token}" \
    -H "Content-Type: application/json" \
    -H "X-Org-ID: ${org_id}" \
    -H "X-Realms: ${realms}" \
    -d "${body}" \
    "http://127.0.0.1:${AUTH_LOCAL_PORT}${TOKEN_EXCHANGE_PATH}" \
    | jq -r '.data.token // empty'
}

api_request() {
  local method="$1"
  local base_url="$2"
  local token="$3"
  local path="$4"
  local data="${5:-}"

  local args=(-s -k -X "${method}" -H "X-Access-Token: Bearer ${token}" -H "Content-Type: application/json" -w '\n%{http_code}')
  [[ -n "${data}" ]] && args+=(-d "${data}")
  curl "${args[@]}" "${base_url}${path}"
}

discover_root_folders() {
  local namespace="$1"
  local repo_name="$2"
  local prov_token="$3"
  local sync_target="${4:-}"
  local base_url="https://127.0.0.1:${PROVISIONING_LOCAL_PORT}"

  if [[ -z "${sync_target}" ]]; then
    local repo_json http_code
    repo_json="$(api_request GET "${base_url}" "${prov_token}" \
      "/apis/provisioning.grafana.app/v0alpha1/namespaces/${namespace}/repositories/${repo_name}")"
    http_code="$(echo "${repo_json}" | tail -n1)"
    repo_json="$(echo "${repo_json}" | sed '$d')"

    if [[ "${http_code}" != "200" ]]; then
      warn "GET repository ${namespace}/${repo_name} returned HTTP ${http_code}"
      STAT_ERRORS+=1
      return 0
    fi

    sync_target="$(echo "${repo_json}" | jq -r '.spec.sync.target // empty')"
  fi

  case "${sync_target}" in
    folder)
      echo "${repo_name}"
      ;;
    folderless)
      local resources_json http_code
      resources_json="$(api_request GET "${base_url}" "${prov_token}" \
        "/apis/provisioning.grafana.app/v0alpha1/namespaces/${namespace}/repositories/${repo_name}/resources")"
      http_code="$(echo "${resources_json}" | tail -n1)"
      resources_json="$(echo "${resources_json}" | sed '$d')"
      if [[ "${http_code}" != "200" ]]; then
        warn "GET resources ${namespace}/${repo_name} returned HTTP ${http_code}"
        STAT_ERRORS+=1
        return 0
      fi
      echo "${resources_json}" | jq -r --arg repo "${repo_name}" '
        .items[]?
        | select(.resource == "folders" or (.group // "") == "folder.grafana.app")
        | select(((.path // "") | rtrimstr("/")) | contains("/") | not)
        | select((.folder // "") == "" or .folder == $repo)
        | .name
      '
      ;;
    instance | "")
      return 0
      ;;
    *)
      return 0
      ;;
  esac
}

default_permission_body() {
  local namespace="$1"
  local folder_uid="$2"
  local permission_name="folder.grafana.app-folders-${folder_uid}"
  jq -nc \
    --arg ns "${namespace}" \
    --arg name "${permission_name}" \
    --arg uid "${folder_uid}" \
    '{
      apiVersion: "iam.grafana.app/v0alpha1",
      kind: "ResourcePermission",
      metadata: {name: $name, namespace: $ns},
      spec: {
        resource: {apiGroup: "folder.grafana.app", resource: "folders", name: $uid},
        permissions: [
          {kind: "BasicRole", name: "Editor", verb: "edit"},
          {kind: "BasicRole", name: "Viewer", verb: "view"}
        ]
      }
    }'
}

ensure_folder_permission() {
  local namespace="$1"
  local folder_uid="$2"
  local iam_token="$3"
  local base_url="https://127.0.0.1:${IAM_LOCAL_PORT}"
  local permission_name="folder.grafana.app-folders-${folder_uid}"
  local path="/apis/iam.grafana.app/v0alpha1/namespaces/${namespace}/resourcepermissions/${permission_name}"

  local resp http_code
  resp="$(api_request GET "${base_url}" "${iam_token}" "${path}")"
  http_code="$(echo "${resp}" | tail -n1)"

  if [[ "${http_code}" == "200" ]]; then
    log "  exists  ${namespace} folder=${folder_uid}"
    STAT_EXISTS+=1
    return 0
  fi
  if [[ "${http_code}" != "404" ]]; then
    warn "  GET ${path} returned HTTP ${http_code}"
    STAT_ERRORS+=1
    return 0
  fi

  local body
  body="$(default_permission_body "${namespace}" "${folder_uid}")"

  if [[ "${DRY_RUN}" == "1" ]]; then
    log "  create  ${namespace} folder=${folder_uid} (dry-run)"
    STAT_WOULD_CREATE+=1
    return 0
  fi

  resp="$(api_request POST "${base_url}" "${iam_token}" \
    "/apis/iam.grafana.app/v0alpha1/namespaces/${namespace}/resourcepermissions" "${body}")"
  http_code="$(echo "${resp}" | tail -n1)"
  if [[ "${http_code}" == "201" || "${http_code}" == "200" ]]; then
    log "  created ${namespace} folder=${folder_uid}"
    STAT_CREATED+=1
  else
    warn "  CREATE ${namespace} folder=${folder_uid} returned HTTP ${http_code}: $(echo "${resp}" | sed '$d')"
    STAT_ERRORS+=1
  fi
}

process_stack() {
  local namespace="$1"
  local cluster="$2"
  local stack_id org_id prov_cap folder_cap prov_token iam_token repos repo folder

  stack_id="$(stack_numeric_id "${namespace}")"
  org_id="$(resolve_org_id "${namespace}")"

  log "stack ${namespace} (cluster=${cluster}, org=${org_id})"
  STAT_STACKS+=1

  prov_cap="$(get_cap_token "${cluster}" "${GRAFANA_APPS_NS}" "${CLUSTER_PROVISIONING_CAP}")"
  [[ -n "${prov_cap}" ]] || die "empty provisioning CAP token (${CLUSTER_PROVISIONING_CAP})"

  prov_token="$(exchange_access_token "${prov_cap}" "${namespace}" "${org_id}" "${stack_id}" "provisioning.grafana.app")"
  [[ -n "${prov_token}" ]] || die "failed to exchange provisioning token for ${namespace}"

  folder_cap="$(get_cap_token "${cluster}" "${GRAFANA_FOLDER_NS}" "${CLUSTER_FOLDER_CAP}")"
  [[ -n "${folder_cap}" ]] || die "empty folder CAP token (${CLUSTER_FOLDER_CAP})"

  iam_token="$(exchange_access_token "${folder_cap}" "${namespace}" "${org_id}" "${stack_id}" "iam.grafana.app")"
  [[ -n "${iam_token}" ]] || die "failed to exchange IAM token for ${namespace}"

  repos="$(api_request GET "https://127.0.0.1:${PROVISIONING_LOCAL_PORT}" "${prov_token}" \
    "/apis/provisioning.grafana.app/v0alpha1/namespaces/${namespace}/repositories")"
  local http_code
  http_code="$(echo "${repos}" | tail -n1)"
  repos="$(echo "${repos}" | sed '$d')"
  if [[ "${http_code}" != "200" ]]; then
    warn "list repositories for ${namespace} returned HTTP ${http_code}"
    STAT_ERRORS+=1
    return 0
  fi

  local repo sync_target folder folder_count
  while IFS=$'\t' read -r repo sync_target; do
    [[ -n "${repo}" ]] || continue
    STAT_REPOS+=1

    case "${sync_target}" in
      instance | "")
        log "repo ${namespace}/${repo} (sync=${sync_target:-unknown}, skipped)"
        continue
        ;;
      folder)
        log "repo ${namespace}/${repo} (sync=folder, folder_uid=${repo})"
        ;;
      folderless)
        log "repo ${namespace}/${repo} (sync=folderless, folder_uids from /resources)"
        ;;
      *)
        log "repo ${namespace}/${repo} (sync=${sync_target}, skipped)"
        continue
        ;;
    esac

    folder_count=0
    while IFS= read -r folder; do
      [[ -n "${folder}" ]] || continue
      folder_count=$((folder_count + 1))
      STAT_ROOT_FOLDERS+=1
      ensure_folder_permission "${namespace}" "${folder}" "${iam_token}"
    done < <(discover_root_folders "${namespace}" "${repo}" "${prov_token}" "${sync_target}")

    if [[ "${sync_target}" == "folderless" && "${folder_count}" -eq 0 ]]; then
      warn "folderless repo ${namespace}/${repo}: no root-level folders matched in /resources (check path and folder fields; top-level folderless folders use folder=\"\")"
      if [[ "${VERBOSE}" == "1" ]]; then
        vlog "folderless /resources folder items for ${namespace}/${repo}:"
        api_request GET "https://127.0.0.1:${PROVISIONING_LOCAL_PORT}" "${prov_token}" \
          "/apis/provisioning.grafana.app/v0alpha1/namespaces/${namespace}/repositories/${repo}/resources" \
          | sed '$d' \
          | jq -r '.items[]? | select(.resource == "folders" or (.group // "") == "folder.grafana.app") | "\(.name)\tpath=\(.path // "")\tfolder=\(.folder // "")"' \
          | while IFS= read -r line; do vlog "  ${line}"; done
      fi
    fi
  done < <(echo "${repos}" | jq -r '.items[]? | [.metadata.name, (.spec.sync.target // empty)] | @tsv')
}

matches_filter() {
  local value="$1"
  local filter_list="$2"
  [[ -z "${filter_list}" ]] && return 0
  local item
  IFS=',' read -r -a _filters <<<"${filter_list}"
  for item in "${_filters[@]}"; do
    [[ "${value}" == "${item}" ]] && return 0
  done
  return 1
}

main() {
  parse_args "$@"
  require_cmd kubectl
  require_cmd curl
  require_cmd jq

  trap cleanup EXIT INT TERM

  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN mode (pass --execute to create permissions)"
  else
    log "EXECUTE mode — will create missing permissions"
  fi

  local -a rows=()
  local line cluster namespace
  # Bash 3.2 (macOS) skips the final row when the file has no trailing newline.
  while IFS=$'\t' read -r namespace cluster _rest || [[ -n "${namespace}" ]]; do
    namespace="${namespace//$'\r'/}"
    cluster="${cluster//$'\r'/}"
    [[ "${namespace}" == "stack_id" ]] && continue
    [[ -n "${namespace}" && -n "${cluster}" ]] || continue
    matches_filter "${cluster}" "${CLUSTER_FILTER}" || continue
    matches_filter "${namespace}" "${STACK_FILTER}" || continue
    rows+=("${cluster}"$'\t'"${namespace}")
  done <"${TSV_FILE}"

  ((${#rows[@]})) || die "no stacks matched filters in ${TSV_FILE}"

  local current_cluster="" processed=0
  for line in "${rows[@]}"; do
    cluster="${line%%$'\t'*}"
    namespace="${line#*$'\t'}"

    if [[ "${LIMIT}" -gt 0 && "${processed}" -ge "${LIMIT}" ]]; then
      log "reached --limit ${LIMIT}"
      break
    fi

    if [[ "${cluster}" != "${current_cluster}" ]]; then
      cleanup
      PF_PIDS=()
      current_cluster="${cluster}"
      log "cluster ${cluster}: setting kubectl context and port-forwards"
      setup_cluster_port_forwards "${cluster}"
    fi

    process_stack "${namespace}" "${cluster}"
    processed=$((processed + 1))
  done

  log "done: stacks=${STAT_STACKS} repos=${STAT_REPOS} root_folders=${STAT_ROOT_FOLDERS} exists=${STAT_EXISTS} would_create=${STAT_WOULD_CREATE} created=${STAT_CREATED} errors=${STAT_ERRORS}"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "dry-run complete — re-run with --execute after review"
  fi
  [[ "${STAT_ERRORS}" -eq 0 ]] || exit 1
}

main "$@"
