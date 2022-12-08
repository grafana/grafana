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
mkdir -p $tmp/usr/share/grafana/bin
mkdir -p $tmp/usr/share/grafana/data/plugins
mkdir -p $tmp/usr/sbin
mkdir -p $tmp/etc/grafana

cp -r ./bin/linux-amd64/* $tmp/usr/sbin/
cp -r ./bin/linux-amd64/* $tmp/usr/share/grafana/bin/
cp -r ./conf $tmp/usr/share/grafana
cp -r ./plugins-bundled $tmp/usr/share/grafana
cp -r ./public $tmp/usr/share/grafana
cp -r ./scripts $tmp/usr/share/grafana
cp -r ./packaging/deb/init.d $tmp/etc
cp -r ./packaging/deb/default $tmp/etc
cp -r ./packaging/deb/systemd $tmp/etc

fpm \
   -s dir \
   --description Grafana \
   -C $tmp \
   --url https://grafana.com \
   --maintainer "contact@grafana.com" \
   --after-install ./packaging/deb/control/postinst \
   --version=$version \
   --name=grafana \
   --vendor=Grafana \
   -a amd64 \
   -p ./grafana-$version.deb \
   -t deb
