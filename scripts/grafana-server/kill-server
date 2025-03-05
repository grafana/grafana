#!/bin/bash

. scripts/grafana-server/variables

if [ -f "$PIDFILE" ]; then
  echo -e "Found pidfile, killing running grafana-server"
  kill -9 `cat $PIDFILE`
  rm $PIDFILE
fi

rm -rf scripts/grafana-server/tmp
