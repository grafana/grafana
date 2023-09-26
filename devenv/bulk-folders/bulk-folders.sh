#!/bin/bash

amount=50
counter=0

while [ $counter -lt $amount ]; do
  echo "$counter"
  counter=$((counter+1))
done
