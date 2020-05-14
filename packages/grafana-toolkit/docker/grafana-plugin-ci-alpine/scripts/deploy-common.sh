#!/bin/sh

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
    [ -n "$1" ] && url=$1 || do_exit "url required" 1
    [ -n "$2" ] && dest=$2 || do_exit "destination required" 2
    sha=$3
    file=$(basename $dest)
    
    wget "$url" -O "$dest"
    if [ -n "$sha" ]; then
        echo "$sha  $dest" | sha256sum || do_exit "Checksum validation failed for $file. Exiting" 1
    fi
}

untar_file () {
    [ -n "$1" ] && src=$1 || do_exit "src required" 1
    [ -n "$2" ] && dest=$2 || dest="/usr/local"

    tar -C "$dest" -xf "$src" && /bin/rm -rf "$src"
}

##
# WIP: Just started this and not finished.
# The intent it to download a release from a git repo,
# compile, and install
get_latest_release () {
	tarsrc=$(curl -sL "https://api.github.com/repos/$1/$2/releases/latest" | jq ".tarball_url" | tr -d '"')
	wget -O /tmp/autoretrieved.tar.gz "$tarsrc"
	origdir=$PWD
	reponame=$(tar zxvf autoretrieved.tar.gz | tail -1 | awk -F / '{print $1}')
	cd "/tmp/$reponame"
	#perform compile
	cd $origdir
}
