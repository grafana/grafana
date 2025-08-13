#!/usr/bin/env bash
set -euo pipefail

usage() {
  {
    echo "run-compiled-tests.sh: Run test binaries in a directory in sequential order, printing the package names before each test."
    echo "usage: $0 <directory> [flags]..."
    echo
    echo "This is expected to be run from the root of the repository."
    echo
    echo "Arguments:"
    echo "  <directory>: The directory containing the compiled test binaries."
    echo "               It will be searched recursively for files ending in .test."
    echo "      [flags]: Flags to pass to the test binaries. 'go test' flags must be prefixed with -test., e.g. -test.v."
  } >&2
}

if [[ $# -lt 1 ]]; then
  echo "Error: No directory specified." >&2
  usage
  exit 1
fi
directory="$1"
shift
flags=("$@")

if [ ! -d "$directory" ]; then
  echo "Error: Directory '$directory' does not exist." >&2
  exit 1
fi

here="$(pwd)" # so we can restore where we are between tests
failures=() # to track which packages fail
find "$directory" -name '*.test' -type f | while read -r test_file; do
  cd "$here" # restore location we were in before
  test_file_abs="$(realpath "$test_file")" # absolute path to the test file, so we can call it from anywhere

  test_package="${test_file%.test}" # remove the .test suffix
  test_package="${test_package#"$directory/"}"
  test_package="./$test_package/"

  if [ ! -d "$test_package" ]; then
    echo "Error: Test package directory '$test_package' does not exist." >&2
    failures+=("$test_package")
    continue
  fi
  if [ ! -x "$test_file_abs" ]; then
    echo "Error: Test file '$test_file_abs' is not executable." >&2
    failures+=("$test_package")
    continue
  fi

  cd "$test_package"
  echo "$test_package"
  "$test_file_abs" "${flags[@]}" || {
    echo "Test failed for package '$test_package'." >&2
    failures+=("$test_package")
  }
done

if [[ ${#failures[@]} -gt 0 ]]; then
  echo "Some tests failed:" >&2
  for failure in "${failures[@]}"; do
    echo "  $failure" >&2
  done
  exit 1
fi
