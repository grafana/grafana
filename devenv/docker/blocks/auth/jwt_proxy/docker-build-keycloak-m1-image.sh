#/bin/sh

VERSION=12.0.1 # set version here

cd /tmp
git clone git@github.com:keycloak/keycloak-containers.git
cd keycloak-containers/server
git checkout $VERSION
docker build -t "quay.io/keycloak/keycloak:${VERSION}" .
