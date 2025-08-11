#!/usr/bin/env bash
set -euo pipefail

usage() {
  {
    echo "compile-tests.sh: Compile Go tests in the given packages."
    echo "                  Reminder: The test binaries must be run separately, and they must use -test. prefixes on flags."
    echo "usage: $0 [-h] [-o <directory>] [-c <flags>]... <packages>..."
    echo
    echo "This is expected to be run from the root of the repository."
    echo
    echo "  -h: Show this help message."
    echo "  -o: The directory to output the compiled tests in."
    echo "  -c: Add compile-time flag to the go test command."
    echo "      This is useful for e.g. -c '-tags=sqlite'."
    echo "      -c and -o are not valid."
    echo "      Can be repeated to specify multiple flags."
  } >&2
}

root="."
# We don't want --exit-code here: git status is only used to ensure that this is a Git repository.
if git status &>/dev/null; then
  root="$(git rev-parse --show-toplevel)"
fi
output_dir="${root}/tests"

flags=()
while getopts ":ho:c:" opt; do
  case $opt in
    h)
      usage
      exit 0
      ;;
    o)
      output_dir="$OPTARG"
      ;;
    c)
      flags+=("$OPTARG")
      ;;
    \?)
      echo "Invalid option -$OPTARG" >&2
      usage
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      usage
      exit 1
      ;;
  esac
done
shift $((OPTIND - 1))

packages=("$@")
if [[ ${#packages[@]} -eq 0 ]]; then
  readarray -t packages < "/dev/stdin"
fi
if [[ ${#packages[@]} -eq 0 ]]; then
  echo "Error: No packages specified." >&2
  usage
  exit 1
fi

if [ -d "$output_dir" ]; then
  rm -r "$output_dir"
fi
mkdir -p "$output_dir"
printf '%s\n' "${packages[@]}" | go run github.com/shenwei356/rush@latest -- "$root/scripts/ci/backend-tests/_compile-single-test.sh" '{}' "${output_dir}" "${flags[@]}" || {
  echo "Error: Failed to compile tests." >&2
  exit 1
}
