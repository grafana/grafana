#!/bin/bash
set -eo pipefail

source "/etc/profile"
source "./deploy-slim.sh"
source "./deploy-common.sh"

NODEVER="v16.13.2"
# Install Node
wget -O - "https://nodejs.org/dist/${NODEVER}/node-${NODEVER}-linux-x64.tar.xz" | tar Jvxf - -C "/tmp"

# Move node to /usr/local so it's in the path
pushd /tmp/node-${NODEVER}-linux-x64
/bin/rm -f CHANGELOG.md README.md LICENSE
/bin/cp -r * /usr/local
popd
/bin/rm -rf /tmp/node-${NODEVER}

# Resource the profile so we know our path is being honoured
source "/etc/profile"
# Install Yarn. Not in the path yet so fully qualified
npm i -g yarn

# Install Go
filename="go1.19.3.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "74b9640724fd4e6bb0ed2a1bc44ae813a03f1e72a4c76253e2d5c015494430ba"
untar_file "/tmp/$filename"

# Install golangci-lint
GOLANGCILINT_VERSION=1.50.0
filename="golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64"
get_file "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/$filename.tar.gz" \
    "/tmp/$filename.tar.gz" \
    "b4b329efcd913082c87d0e9606711ecb57415b5e6ddf233fde9e76c69d9b4e8b"
untar_file "/tmp/$filename.tar.gz"
ln -s /usr/local/${filename}/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
chmod 755 /usr/local/bin/golangci-lint

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "20d1d4e2b399d0287d91e65faeee8ffbef08e3262b0be5eda7def7b3c2799ddd"
chmod 755 /usr/local/bin/cc-test-reporter

wget -O /usr/local/bin/grabpl "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v2.9.27/grabpl"
chmod +x /usr/local/bin/grabpl

# Install Mage
mkdir -pv /tmp/mage $HOME/go/bin
git clone https://github.com/magefile/mage.git /tmp/mage
pushd /tmp/mage && go run bootstrap.go && popd
mv $HOME/go/bin/mage /usr/local/bin
# Cleanup after yourself
/bin/rm -rf /tmp/mage
/bin/rm -rf $HOME/go

# add cypress
yarn global add cypress
# verify cypress install
cypress verify

# Get the size down
/bin/rm -rf /var/lib/apt/lists
