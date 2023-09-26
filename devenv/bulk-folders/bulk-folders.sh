#!/bin/bash

amount=50
counter=0

while [ $counter -lt $amount ]; do
  echo "$counter"
  mkdir -p "bulk-folders/Bulk Folder ${counter}"
  jsonnet -o "bulk-folders/Bulk Folder ${counter}/dashboard${counter}.json" -e "local bulkDash = import 'bulk-dashboards/bulkdash.jsonnet'; bulkDash + {  uid: 'bulk-folder-${counter}',  title: 'title-${counter}' }"
  counter=$((counter+1))
done
