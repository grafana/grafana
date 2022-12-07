#!/usr/bin/env bash
version=${1:-9.4.0-hgmt.1}
echo "Packaging for $version"

# install node deps
yarn

# give node more space
export NODE_OPTIONS=--max_old_space_size=10000

# compile
make build


folder="grafana-$version"
tmp="/tmp/$folder"

# package
mkdir -p $tmp

cp -r ./bin/linux-amd64 $tmp/bin
cp -r ./conf $tmp
cp -r ./plugins-bundled $tmp
cp -r ./public $tmp
cp -r ./scripts $tmp
cp -r ./packaging/deb $tmp

fpm \
   -s dir \
   --description Grafana \
   -C $tmp \
   --url https://grafana.com \
   --maintainer "contact@grafana.com" \
   --config-files $tmp/deb/init.d \
   --config-files $tmp/deb/default \
   --config-files $tmp/deb/systemd \
   --after-install $tmp/deb/control/postinst \
   --version=$version \
   --name=grafana \
   --vendor=Grafana \
   -a amd64 \
   -p ./grafana-$version.deb \
   -t deb
