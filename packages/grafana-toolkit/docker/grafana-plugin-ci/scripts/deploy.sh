#!/bin/bash
source "./deploy-common.sh"

# Install Go
filename="go1.15.1.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "70ac0dbf60a8ee9236f337ed0daa7a4c3b98f6186d4497826f68e97c0c0413f6"
untar_file "/tmp/$filename"

# Install golangci-lint
GOLANGCILINT_VERSION=1.31.0
filename="golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64"
get_file "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/$filename.tar.gz" \
    "/tmp/${filename}.tar.gz" \
    "9a5d47b51442d68b718af4c7350f4406cdc087e2236a5b9ae52f37aebede6cb3"
untar_file "/tmp/${filename}.tar.gz"
ln -s /usr/local/${filename}/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
chmod 755 /usr/local/bin/golangci-lint

# Install dependencies
apt-get update -y && apt-get install -y adduser libfontconfig1 locate && /bin/rm -rf /var/lib/apt/lists/*

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "b4138199aa755ebfe171b57cc46910b13258ace5fbc4eaa099c42607cd0bff32"
chmod +x /usr/local/bin/cc-test-reporter

wget -O /usr/local/bin/grabpl "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v0.5.16/grabpl"
chmod +x /usr/local/bin/grabpl

# Install Mage
mkdir -pv /tmp/mage $HOME/go/bin
git clone https://github.com/magefile/mage.git /tmp/mage
pushd /tmp/mage && go run bootstrap.go && popd
mv $HOME/go/bin/mage /usr/local/bin

GOOGLE_SDK_VERSION=308.0.0
GOOGLE_SDK_CHECKSUM=9e8e31d9503340fc912374311ac1fffbfc5b59748d20b681f9aca3de2b68deb5

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
