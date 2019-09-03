#!/bin/bash

mkdir -p ~/.rpmdb/pubkeys
curl -s https://packages.grafana.com/gpg.key > ~/.rpmdb/pubkeys/grafana.key

ALL_SIGNED=0

for file in dist/*.rpm; do
  if rpm -K "$file" | grep "pgp.*OK" -q ; then
    echo "$file" OK
  else
    ALL_SIGNED=1
    echo "$file" NOT SIGNED
  fi
done

exit $ALL_SIGNED
