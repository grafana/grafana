#!/bin/sh

set -exu

url="$1"
sha256="$2"
shift;shift
files_to_copy="$@"

COPY_DIRS="${COPY_DIRS:-}"

# download and extract library
# requires binutils and xz packages
curl -Ls ${url} -o /tmp/libs.tar.xz
echo "${sha256}  /tmp/libs.tar.xz" | sha256sum -c -
mkdir /tmp/libs
tar xf /tmp/libs.tar.xz -C /tmp/libs
for file in ${files_to_copy}; do
  strip /tmp/libs/${file}
  mv /tmp/libs/${file} /usr/glibc-compat/lib
done

# copy any extra required directories
for dir in ${COPY_DIRS}; do
  cp -r /tmp/libs/${dir} /${dir}
done

# clean up
rm -rf /tmp/libs /tmp/libs.tar.xz
