#!/bin/bash

##
# Script to deploy a docker image. Must return exit code 0
#
do_exit() {
    message="$1"
    exit_code="$2"

    echo "$message"
    exit $exit_code
}

##
# Get file, get's a file, validates the SHA
# @param filename
# @param expected sha value
# @returns 0 if successful, -1 of checksum validation failed.
#
get_file () {
    [ -n "$1" ] && url=$1 || do_exit "url required" -1
    [ -n "$2" ] && dest=$2 || do_exit "destination required" -2
    sha=$3
    file=$(basename $dest)

    wget "$url" -O "$dest"
    if [ -n "$sha" ]; then
        echo "$sha $dest" | sha256sum --check --status || do_exit "Checksum validation failed for $file. Exiting" -1
    fi
}

untar_file () {
    [ -n "$1" ] && src=$1 || do_exit "src required" -1
    [ -n "$2" ] && dest=$2 || dest="/usr/local"

    tar -C "$dest" -xf "$src" && /bin/rm -rf "$src"
}
