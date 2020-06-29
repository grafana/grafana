#!/bin/sh
set -eo pipefail
source "./deploy-common.sh"

# Make libgcc compatible
mkdir /lib64 && ln -s /lib/libc.musl-x86_64.so.1 /lib64/ld-linux-x86-64.so.2

# Replace cp with something that mocks the one that ci-package needs
rm /bin/cp
mv /usr/local/bin/cp /bin/cp

sed -i -e 's/v[[:digit:]]\..*\//edge\//g' /etc/apk/repositories
apk add nodejs npm yarn build-base openssh git-lfs perl-utils

#
# Only relevant for testing, but cypress does not work with musl/alpine.
#
# apk add xvfb glib nss nspr gdk-pixbuf "gtk+3.0" pango atk cairo dbus-libs libxcomposite libxrender libxi libxtst libxrandr libxscrnsaver alsa-lib at-spi2-atk at-spi2-core cups-libs gcompat libc6-compat

# Install Go
filename="go1.14.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "08df79b46b0adf498ea9f320a0f23d6ec59e9003660b4c9c1ce8e5e2c6f823ca"
untar_file "/tmp/$filename"

# Install golangci-lint
filename="golangci-lint-1.26.0-linux-amd64"
get_file "https://github.com/golangci/golangci-lint/releases/download/v1.26.0/$filename.tar.gz" \
    "/tmp/$filename.tar.gz" \
    "59b0e49a4578fea574648a2fd5174ed61644c667ea1a1b54b8082fde15ef94fd"
untar_file "/tmp/$filename.tar.gz"
ln -s /usr/local/${filename}/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
chmod 755 /usr/local/bin/golangci-lint

# Install dependencies
apk add fontconfig zip jq

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "b4138199aa755ebfe171b57cc46910b13258ace5fbc4eaa099c42607cd0bff32"
chmod +x /usr/local/bin/cc-test-reporter

wget -O /usr/local/bin/grabpl "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v0.4.4/grabpl"
chmod +x /usr/local/bin/grabpl

apk add git
# Install Mage
mkdir -pv /tmp/mage $HOME/go/bin
git clone https://github.com/magefile/mage.git /tmp/mage
cd /tmp/mage && go run bootstrap.go
mv $HOME/go/bin/mage /usr/local/bin

wget -O - -q https://raw.githubusercontent.com/securego/gosec/master/install.sh | sh -s -- -b /usr/local/bin v2.2.0

source "/etc/profile"
sh -l -c "go get -u github.com/mgechev/revive"
for file in $(ls $HOME/go/bin); do
	mv -v $HOME/go/bin/$file /usr/local/bin/$file
done

# Install grafana-toolkit deps
current_dir=$PWD
cd /usr/local/grafana-toolkit && yarn install && cd $current_dir
ln -s /usr/local/grafana-toolkit/bin/grafana-toolkit.js /usr/local/bin/grafana-toolkit

# Cleanup after yourself
/bin/rm -rf /tmp/mage 
/bin/rm -rf $HOME/go
/bin/rm -rf /var/cache/apk/*
