#/bin/bash

if ! type "jsonnet" > /dev/null; then
  echo "you need you install jsonnet to run this script"
  echo "follow the instructions on https://github.com/google/jsonnet"
  exit 1
fi

COUNTER=0
MAX=400
while [  $COUNTER -lt $MAX ]; do
    jsonnet -o "bulk-testing/dashboard${COUNTER}.json" -e "local bulkDash = import 'bulk-testing/bulkdash.jsonnet'; bulkDash + {  uid: 'uid-${COUNTER}',  title: 'title-${COUNTER}' }"
    let COUNTER=COUNTER+1 
done

