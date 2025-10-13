#!/bin/bash

_files=$*

if [ -z "$_files" ]; then
    echo "_files (arg 1) has to be set"
    exit 1
fi

mkdir -p ~/.rpmdb/pubkeys
curl -s https://packages.grafana.com/gpg.key > ~/.rpmdb/pubkeys/grafana.key

ALL_SIGNED=0

for file in $_files; do
  if rpm -K "$file" | grep "digests signatures OK" -q ; then
    echo "$file" OK
  else
    ALL_SIGNED=1
    echo "$file" NOT SIGNED
  fi
done

exit $ALL_SIGNED
