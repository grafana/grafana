#!/bin/bash
set -eo pipefail

source "/etc/profile"
source "./deploy-slim.sh"
source "./deploy-common.sh"

NODEVER="v12.18.3-linux-x64"
# Install Node
wget -O - "https://nodejs.org/dist/v12.18.3/node-${NODEVER}.tar.xz" | tar Jvxf - -C "/tmp"

# Move node to /usr/local so it's in the path
pushd /tmp/node-${NODEVER}
/bin/rm -f CHANGELOG.md README.md LICENSE
/bin/cp -r * /usr/local
popd
/bin/rm -rf /tmp/node-${NODEVER}

# Resource the profile so we know our path is being honoured
source "/etc/profile"
# Install Yarn. Not in the path yet so fully qualified
npm i -g yarn

# Install Go
filename="go1.15.1.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "70ac0dbf60a8ee9236f337ed0daa7a4c3b98f6186d4497826f68e97c0c0413f6"
untar_file "/tmp/$filename"

# Install golangci-lint
GOLANGCILINT_VERSION=1.31.0
filename="golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64"
get_file "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/$filename.tar.gz" \
    "/tmp/$filename.tar.gz" \
    "9a5d47b51442d68b718af4c7350f4406cdc087e2236a5b9ae52f37aebede6cb3"
untar_file "/tmp/$filename.tar.gz"
ln -s /usr/local/${filename}/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
chmod 755 /usr/local/bin/golangci-lint

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "b4138199aa755ebfe171b57cc46910b13258ace5fbc4eaa099c42607cd0bff32"
chmod 755 /usr/local/bin/cc-test-reporter

wget -O /usr/local/bin/grabpl "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v0.5.16/grabpl"
chmod +x /usr/local/bin/grabpl

# Install Mage
mkdir -pv /tmp/mage $HOME/go/bin
git clone https://github.com/magefile/mage.git /tmp/mage
pushd /tmp/mage && go run bootstrap.go && popd
mv $HOME/go/bin/mage /usr/local/bin
# Cleanup after yourself
/bin/rm -rf /tmp/mage
/bin/rm -rf $HOME/go

# Install grafana-toolkit deps
pushd /usr/local/grafana-toolkit
yarn install
ln -s /usr/local/grafana-toolkit/bin/grafana-toolkit.js /usr/local/bin/grafana-toolkit
popd

# Get the size down
/bin/rm -rf /var/lib/apt/lists
