#!/bin/bash

cd ..
git clone -b master --single-branch git@github.com:grafana/grafana-enterprise.git --depth 1
cd grafana-enterprise
./build.sh
