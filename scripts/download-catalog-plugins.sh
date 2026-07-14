#!/usr/bin/env bash
# Download plugins from grafana.com into a directory (for data/plugins-bundled).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRAFANA_CATALOG_API="${GRAFANA_CATALOG_API:-https://grafana.com/api/plugins}"
DEFAULTS_FILE="${SCRIPT_DIR}/catalog-plugins-defaults"

usage() {
  cat >&2 <<'EOF'
Usage: download-catalog-plugins.sh --os GOOS --arch GOARCH
  [--out DIR] [--grafana-version VER] [--no-default-catalog-plugins]
  [--plugins id,id:version,...]
EOF
  exit 2
}

require_cmds() {
  local c
  for c in curl jq unzip openssl; do
    if ! command -v "$c" >/dev/null 2>&1; then
      echo "download-catalog-plugins: required command not found: $c" >&2
      exit 1
    fi
  done
}

extract_plugin_zip() {
  local zipfile="$1"
  local dest="$2"
  local tmp
  tmp="$(mktemp -d)"
  if ! unzip -q -o "$zipfile" -d "$tmp"; then
    rm -rf "$tmp"
    return 1
  fi
  rm -rf "$dest"
  mkdir -p "$dest"

  local dir_count file_count root_dir
  dir_count="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  file_count="$(find "$tmp" -mindepth 1 -maxdepth 1 ! -type d 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$dir_count" -eq 1 && "$file_count" -eq 0 ]]; then
    root_dir="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
    cp -a "${root_dir}/." "${dest}/"
  else
    cp -a "${tmp}/." "${dest}/"
  fi
  rm -rf "$tmp"
}

merge_specs_lines() {
  # stdin: lines "id|version" (checksum optional as id|ver|sha — ver/sha may be empty). stdout: stable "id|version|checksum".
  # Deduplication matches pkg/build/daggerbuild/arguments.MergeCatalogPluginSpecs (first-seen order preserved).
  awk -F'|' '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    NF < 1 { next }
    {
      id = trim($1)
      v = (NF >= 2 ? trim($2) : "")
      csum = (NF >= 3 ? trim($3) : "")
      if (id == "") next
      if (!(id in seen)) {
        n++
        order[n] = id
        ver[id] = v
        chk[id] = csum
        seen[id] = 1
        next
      }
      if (ver[id] == v) {
        if (chk[id] == csum || csum == "") next
        if (chk[id] == "") { chk[id] = csum; next }
        print "download-catalog-plugins: conflicting checksums for plugin " id > "/dev/stderr"
        exit 1
      }
      if (ver[id] == "") {
        ver[id] = v
        if (chk[id] == "" && csum != "") chk[id] = csum
        next
      }
      if (v == "") {
        if (csum != "" && chk[id] == "") chk[id] = csum
        next
      }
      print "download-catalog-plugins: conflicting versions for plugin " id ": " ver[id] " vs " v > "/dev/stderr"
      exit 1
    }
    END {
      for (i = 1; i <= n; i++) {
        id = order[i]
        print id "|" ver[id] "|" chk[id]
      }
    }'
}

fetch_resolved_meta() {
  # GET /api/plugins/{id}/versions — headers match pkg/plugins/repo.Client.createReq (resolver runs in Go before Dagger download).
  local plugin_id="$1"
  local grafana_ver="$2"
  local os="$3"
  local arch="$4"
  local os_arch_key
  os_arch_key="$(echo "${os}" | tr '[:upper:]' '[:lower:]')-${arch}"

  local url="${GRAFANA_CATALOG_API}/${plugin_id}/versions"
  local hdrs=(-fSL)
  if [[ -n "${grafana_ver}" ]]; then
    hdrs+=(-H "grafana-version: ${grafana_ver}" -H "User-Agent: grafana ${grafana_ver}")
  fi
  hdrs+=(-H "grafana-os: ${os}" -H "grafana-arch: ${arch}")

  local json
  if ! json="$(curl "${hdrs[@]}" -- "${url}")"; then
    echo "download-catalog-plugins: failed to fetch versions for ${plugin_id}" >&2
    return 1
  fi

  # Selection matches pkg/plugins/repo.latestSupportedVersion + SelectSystemCompatibleVersion (version ""):
  # supportsCurrentArch true when .packages is null (Go Arch nil).
  jq -r --arg k "${os_arch_key}" '
    (.items // [])
    | map(select(.isCompatible == null or .isCompatible == true))
    | map(select(.packages == null or (.packages[$k] != null) or (.packages["any"] != null)))
    | if length == 0 then error("no compatible version on \($k)")
      else .[0] | {
          version: .version,
          sha256: (
            if .packages == null then ""
            else ((.packages[$k] // .packages["any"] // {}).sha256 // "")
            end
          )
        } end
  ' <<<"${json}"
}

download_plugin_archive() {
  local plugin_id="$1"
  local resolved_version="$2"
  local want_checksum="$3"
  local grafana_ver="$4"
  local os="$5"
  local arch="$6"
  local out_zip="$7"

  local dl_url="${GRAFANA_CATALOG_API}/${plugin_id}/versions/${resolved_version}/download"
  # pkg/build/daggerbuild/plugins.DownloadPlugins curl (zip fetch), not repo.Client User-Agent.
  local hdrs=(-fSL -H "User-Agent: grafana-build")
  if [[ -n "${grafana_ver}" ]]; then
    hdrs+=(-H "grafana-version: ${grafana_ver}")
  fi
  hdrs+=(-H "grafana-os: ${os}" -H "grafana-arch: ${arch}")

  if ! curl "${hdrs[@]}" -o "${out_zip}" -- "${dl_url}"; then
    echo "download-catalog-plugins: download failed for ${plugin_id} ${resolved_version}" >&2
    return 1
  fi

  if [[ -n "${want_checksum}" ]]; then
    want_checksum="${want_checksum#sha256:}"
    local got
    got="$(openssl dgst -sha256 "${out_zip}" | awk '{print $2}')"
    if [[ "${got}" != "${want_checksum}" ]]; then
      echo "download-catalog-plugins: checksum mismatch for ${plugin_id} (expected ${want_checksum}, got ${got})" >&2
      return 1
    fi
  fi
}

main() {
  local out="data/plugins-bundled"
  local grafana_version=""
  local os_str=""
  local arch_str=""
  local no_default=0
  local plugins_csv=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --out)
        out="$2"
        shift 2
        ;;
      --grafana-version)
        grafana_version="$2"
        shift 2
        ;;
      --os)
        os_str="$2"
        shift 2
        ;;
      --arch)
        arch_str="$2"
        shift 2
        ;;
      --no-default-catalog-plugins)
        no_default=1
        shift
        ;;
      --plugins)
        plugins_csv="$2"
        shift 2
        ;;
      -h | --help)
        usage
        ;;
      *)
        echo "download-catalog-plugins: unknown argument: $1" >&2
        exit 2
        ;;
    esac
  done

  if [[ -z "${os_str}" || -z "${arch_str}" ]]; then
    echo "download-catalog-plugins: --os and --arch are required" >&2
    exit 2
  fi

  require_cmds

  # Not local: EXIT runs after main returns, so locals would be unbound (set -u) when cleanup runs.
  specs_tmp="$(mktemp)"
  cleanup_specs() { rm -f "$specs_tmp"; }
  trap 'cleanup_specs' EXIT

  if [[ "${no_default}" -eq 0 ]]; then
    if [[ ! -f "${DEFAULTS_FILE}" ]]; then
      echo "download-catalog-plugins: missing ${DEFAULTS_FILE}" >&2
      exit 1
    fi
    while IFS= read -r line || [[ -n "${line}" ]]; do
      [[ "${line}" =~ ^[[:space:]]*# ]] && continue
      line="$(echo "${line}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      [[ -z "${line}" ]] && continue
      if [[ "${line}" == *:*:* ]]; then
        _pps_id="${line%%:*}"
        _pps_sha="${line#*:*:}"
        _pps_ver="${line#*:}"
        _pps_ver="${_pps_ver%%:*}"
        printf '%s\n' "${_pps_id}|${_pps_ver}|${_pps_sha}" >>"${specs_tmp}"
      elif [[ "${line}" == *:* ]]; then
        printf '%s\n' "${line%%:*}|${line#*:}|" >>"${specs_tmp}"
      else
        printf '%s\n' "${line}||" >>"${specs_tmp}"
      fi
    done <"${DEFAULTS_FILE}"
  fi
  if [[ -n "${plugins_csv}" ]]; then
    local part
    IFS=',' read -r -a parts <<<"${plugins_csv}"
    for part in "${parts[@]}"; do
      part="$(echo "${part}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      [[ -z "${part}" ]] && continue
      # id, id:version, or id:version:sha256 (sha256 optional; matches catalog plugin spec)
      if [[ "${part}" == *:*:* ]]; then
        _pps_id="${part%%:*}"
        _pps_sha="${part#*:*:}"
        _pps_ver="${part#*:}"
        _pps_ver="${_pps_ver%%:*}"
        printf '%s\n' "${_pps_id}|${_pps_ver}|${_pps_sha}" >>"${specs_tmp}"
      elif [[ "${part}" == *:* ]]; then
        printf '%s\n' "${part%%:*}|${part#*:}|" >>"${specs_tmp}"
      else
        printf '%s\n' "${part}||" >>"${specs_tmp}"
      fi
    done
  fi

  rm -rf "${out}"
  mkdir -p "${out}"

  local line plugin_id plan_ver spec_checksum meta resolved_ver sha tmp_zip
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    IFS='|' read -r plugin_id plan_ver spec_checksum <<<"${line}"

    if [[ -n "${plan_ver}" ]]; then
      # pkg/build/daggerbuild/plugins.ResolvePluginVersions (pinned): no versions API call;
      # URL from BuildPluginDownloadURL; checksum only from spec (optional).
      resolved_ver="${plan_ver}"
      sha="${spec_checksum}"
      if [[ -n "${sha}" ]]; then
        sha="${sha#sha256:}"
      fi
    else
      meta="$(fetch_resolved_meta "${plugin_id}" "${grafana_version}" "${os_str}" "${arch_str}")"
      resolved_ver="$(jq -r '.version' <<<"${meta}")"
      sha="$(jq -r '.sha256 // empty' <<<"${meta}")"
      if [[ -n "${spec_checksum}" ]]; then
        spec_checksum="${spec_checksum#sha256:}"
        if [[ -n "${spec_checksum}" ]]; then
          sha="${spec_checksum}"
        fi
      fi
    fi

    tmp_zip="$(mktemp)"

    download_plugin_archive "${plugin_id}" "${resolved_ver}" "${sha}" "${grafana_version}" "${os_str}" "${arch_str}" "${tmp_zip}"
    extract_plugin_zip "${tmp_zip}" "${out}/${plugin_id}"
    rm -f "${tmp_zip}"
  done < <(merge_specs_lines <"${specs_tmp}")
}

main "$@"
