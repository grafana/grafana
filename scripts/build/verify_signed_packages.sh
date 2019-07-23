#!/bin/bash

_files=$*

ALL_SIGNED=0

for file in $_files; do
  if rpm -K "$file" | grep "pgp.*OK" -q ; then
    echo "$file" OK
  else
    ALL_SIGNED=1
    echo "$file" NOT SIGNED
  fi
done

exit $ALL_SIGNED
