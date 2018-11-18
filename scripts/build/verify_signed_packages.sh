#!/bin/bash
_files=$*

ALL_SIGNED=0

for file in $_files; do
  rpm -K "$file" | grep "pgp.*OK" -q
  if [[ $? != 0 ]]; then
    ALL_SIGNED=1
    echo $file NOT SIGNED
  else
    echo $file OK
  fi
done


exit $ALL_SIGNED
