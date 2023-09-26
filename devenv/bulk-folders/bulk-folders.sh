#!/bin/bash

amount=50
counter=0

while [ $counter -lt $amount ]; do
  echo "$counter"
  mkdir -p "bulk-folders/Bulk Folder ${counter}"
  counter=$((counter+1))
done
