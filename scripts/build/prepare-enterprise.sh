#!/bin/bash

cd ..

if [ -z "$CIRCLE_TAG" ]; then
  _target="master"
else
  _target="$CIRCLE_TAG"
fi

git clone -b "$_target" --single-branch git@github.com:grafana/grafana-enterprise.git --depth 1

cd grafana-enterprise || exit
./build.sh
