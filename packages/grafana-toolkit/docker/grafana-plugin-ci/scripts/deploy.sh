#!/bin/bash
source "./deploy-common.sh"

# Install Go
filename="go1.16.1.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "3edc22f8332231c3ba8be246f184b736b8d28f06ce24f08168d8ecf052549769"
untar_file "/tmp/$filename"

# Install golangci-lint
GOLANGCILINT_VERSION=1.37.0
filename="golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64"
get_file "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/$filename.tar.gz" \
    "/tmp/$filename.tar.gz" \
    "5fe9852e754b621c5264fb8ac810a75033e7f18e972315a60c5c3f8a37b3cb88"
untar_file "/tmp/$filename.tar.gz"
ln -s /usr/local/${filename}/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
chmod 755 /usr/local/bin/golangci-lint

# Install dependencies
apt-get update -y && apt-get install -y adduser libfontconfig1 locate && /bin/rm -rf /var/lib/apt/lists/*

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "e1be1930379bd169d3a8e82135cf57216ad52ecfaf520b5804f269721e4dcc3d"
chmod 755 /usr/local/bin/cc-test-reporter

wget -O /usr/local/bin/grabpl "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v0.5.38/grabpl"
chmod +x /usr/local/bin/grabpl

# Install Mage
mkdir -pv /tmp/mage $HOME/go/bin
git clone https://github.com/magefile/mage.git /tmp/mage
pushd /tmp/mage && go run bootstrap.go && popd
mv $HOME/go/bin/mage /usr/local/bin

GOOGLE_SDK_VERSION=316.0.0
GOOGLE_SDK_CHECKSUM=96a0b75474dbfa9f3d46dcdec7a4d68a664cb7d57fade5710fe88b1fdf6babb3

curl -fLO https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz
echo "${GOOGLE_SDK_CHECKSUM} google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz" | sha256sum --check --status
tar xvzf google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz -C /opt
rm google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz
ln -s /opt/google-cloud-sdk/bin/gsutil /usr/bin/gsutil
ln -s /opt/google-cloud-sdk/bin/gcloud /usr/bin/gcloud

# Cleanup after yourself
/bin/rm -rf /tmp/mage
/bin/rm -rf $HOME/go

# Perform user specific initialization
sudo -u circleci ./deploy-user.sh

# Get the size down
/bin/rm -rf /var/lib/apt/lists
