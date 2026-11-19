#!/usr/bin/env bash
set -euo pipefail

root=$(pwd -P)
script=$(realpath "$0")
unit_shard=${UNIT_SHARD:-1/8}
sql_shard=${SQL_SHARD:-13/16}
tmpdir=${TMPDIR:-${RUNNER_TEMP:-/tmp}}
mode=$1
shift

package_list() {
  case "$1" in
    unit) bash scripts/ci/backend-tests/shard.sh -N "$unit_shard" ;;
    sql)
      bash scripts/ci/backend-tests/pkgs-with-tests-named.sh -b TestIntegration |
        bash scripts/ci/backend-tests/shard.sh -N "$sql_shard" -d -
      ;;
  esac
}

test_summary() {
  jq -nc '
    reduce inputs as $event ({packages: 0, passed: 0, skipped: 0};
      if $event.Action == "pass" then
        if $event.Test then .passed += 1 else .packages += 1 end
      elif $event.Action == "skip" and $event.Test then .skipped += 1
      else .
      end)
    | select(.packages > 0 and .passed > 0)
  ' < "$1" | tee "$2"
  test -s "$2"
}

run_tests() {
  local log=$1 report=$2
  shift 2
  if ! "$@" > "$log"; then
    tail -100 "$log" >&2
    return 1
  fi
  test_summary "$log" "$report"
}

run_compiled_sql() {
  local binaries=$1 binary relative
  while IFS= read -r binary; do
    relative=${binary#"$binaries"/}
    (
      cd "$root/${relative%.test}" &&
        go tool test2json -t -p "github.com/grafana/grafana/${relative%.test}" \
          "$binary" -test.v=test2json -test.timeout=12m -test.run '^TestIntegration'
    ) || return 1
  done < <(find "$binaries" -type f -name '*.test' | LC_ALL=C sort)
}

wait_for_database() {
  local attempt
  for ((attempt = 0; attempt < 60; attempt++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  printf '%s did not accept SQL queries in time\n' "$mode" >&2
  return 1
}

case "$mode" in
  capture)
    relative=${root#"$BENCH_SOURCE"/}
    test "$relative" != "$root"
    install -Dm755 "$1" "$BENCH_OUTPUT/$relative.test"
    ;;
  unit|compile|native-sql)
    if [[ "$mode" == unit ]]; then suite=unit; else suite=sql; fi
    list=$(package_list "$suite")
    test -n "$list"
    mapfile -t packages <<< "$list"
    printf 'Benchmark packages: %s\n' "${#packages[@]}"
    case "$mode" in
      unit)
        time run_tests "$tmpdir/unit-tests.log" "$1" \
          go test -json -vet=off -short -timeout=30m "${packages[@]}"
        ;;
      compile)
        export BENCH_SOURCE="$root" BENCH_OUTPUT="$1"
        mkdir -p "$BENCH_OUTPUT"
        time go test -vet=off -count=1 -run='^$' -exec "bash '$script' capture" "${packages[@]}"
        test -n "$(find "$BENCH_OUTPUT" -type f -name '*.test' -print -quit)"
        ;;
      native-sql)
        time go test -vet=off -run='^$' "${packages[@]}"
        time run_tests "$tmpdir/sql-tests.log" "$1" \
          go test -json -vet=off -p=1 -count=1 -timeout=12m -run '^TestIntegration' "${packages[@]}"
        ;;
    esac
    ;;
  compiled-sql)
    printf 'Benchmark binaries: %s\n' "$(find "$1" -type f -name '*.test' | wc -l)"
    time run_tests "$tmpdir/sql-tests.log" "$2" run_compiled_sql "$1"
    ;;
  mysql|postgres)
    export GRAFANA_TEST_DB="$mode" TESTCONTAINERS_RYUK_DISABLED=true
    case "$mode" in
      mysql)
        export MYSQL_HOST=127.0.0.1
        make devenv sources=mysql_tests mysql_version=8.0.43
        wait_for_database mysql -h 127.0.0.1 -P 3306 -uroot -prootpass -e 'SELECT 1'
        exec bash "$script" "$@"
        ;;
      postgres)
        export POSTGRES_HOST=127.0.0.1 PGPASSWORD=grafanatest
        make devenv sources=postgres_tests
        # The container initializes this fixture database before serving TCP.
        wait_for_database psql -p 5432 -h 127.0.0.1 -U grafanatest -d grafanadstest -c 'SELECT 1'
        exec bash "$script" "$@"
        ;;
    esac
    ;;
  *)
    printf 'Unknown test benchmark mode %s\n' "$mode" >&2
    exit 2
    ;;
esac
