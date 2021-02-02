#!/bin/bash
set -eo pipefail

source "/etc/profile"
source "./deploy-slim.sh"
source "./deploy-common.sh"

NODEVER="v12.19.0-linux-x64"
# Install Node
wget -O - "https://nodejs.org/dist/v12.19.0/node-${NODEVER}.tar.xz" | tar Jvxf - -C "/tmp"

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
filename="go1.15.7.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "0d142143794721bb63ce6c8a6180c4062bcf8ef4715e7d6d6609f3a8282629b3"
untar_file "/tmp/$filename"

# Install golangci-lint
GOLANGCILINT_VERSION=1.36.0
filename="golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64"
get_file "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/$filename.tar.gz" \
    "/tmp/$filename.tar.gz" \
    "9b8856b3a1c9bfbcf3a06b78e94611763b79abd9751c245246787cd3bf0e78a5"
untar_file "/tmp/$filename.tar.gz"
ln -s /usr/local/${filename}/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
chmod 755 /usr/local/bin/golangci-lint

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "e1be1930379bd169d3a8e82135cf57216ad52ecfaf520b5804f269721e4dcc3d"
chmod 755 /usr/local/bin/cc-test-reporter

wget -O /usr/local/bin/grabpl "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v0.5.35/grabpl"
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
