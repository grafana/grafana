#!/usr/bin/env bash
set -euo pipefail

# THIS IS AN INTERNAL SCRIPT. DO NOT USE IT DIRECTLY.
# See compile-tests.sh for the public interface of this.

pkg="$1"
output_dir="$2"
shift 2
flags=("$@")

output_file="$output_dir/$(dirname "$pkg")/$(basename "$pkg").test"
mkdir -p "$(dirname "$output_file")"
exec go test -c -o "$output_file" "${flags[@]}" "$pkg"
echo "$pkg" > "$output_file.package.txt"
