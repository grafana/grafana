#!/bin/sh

# ./download-lib.sh acquires prebuilt libraries from the archlinux repository for alpine.
# It requires binutils and xz packages.

set -eu
if [ -n "${DEBUG:-}" ]; then set -x; fi

url="$1"
sha256="$2"
shift;shift
files_to_copy="$@"

if [ -z "$files_to_copy" ]; then
  echo "\$files_to_copy was empty"
  exit 1
fi

COPY_DIRS="${COPY_DIRS:-}"

echo -n "Installing ${files_to_copy}..."

# Download library.
curl -Ls ${url} -o /tmp/libs.tar.xz
set +e
echo "${sha256}  /tmp/libs.tar.xz" | sha256sum -sc -
if [ $? -ne 0 ]; then
  echo "checksum failed"
  echo "wanted ${sha256}  /tmp/libs.tar.xz"
  echo "got    $(sha256sum /tmp/libs.tar.xz)"
  exit 1
fi
set -e

# Extract and copy.
mkdir /tmp/libs
tar xf /tmp/libs.tar.xz -C /tmp/libs
for file in ${files_to_copy}; do
  strip /tmp/libs/${file}
  mv /tmp/libs/${file} /usr/glibc-compat/lib
done

# Copy any extra required directories.
for dir in ${COPY_DIRS}; do
  cp -r /tmp/libs/${dir} /${dir}
done

# Clean up.
rm -rf /tmp/libs /tmp/libs.tar.xz

echo "done"
