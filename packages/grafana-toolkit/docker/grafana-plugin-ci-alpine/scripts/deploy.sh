#!/bin/sh
set -eo pipefail

source "./deploy-common.sh"

# Make libgcc compatible
mkdir /lib64 && ln -s /lib/libc.musl-x86_64.so.1 /lib64/ld-linux-x86-64.so.2

# Replace cp with something that mocks the one that ci-package needs
rm /bin/cp
mv /usr/local/bin/cp /bin/cp

apk add --no-cache curl 'nodejs-current=14.5.0-r0' npm yarn build-base openssh git-lfs perl-utils coreutils python3

#
# Only relevant for testing, but cypress does not work with musl/alpine.
#
# apk add --no-cache xvfb glib nss nspr gdk-pixbuf "gtk+3.0" pango atk cairo dbus-libs libxcomposite libxrender libxi libxtst libxrandr libxscrnsaver alsa-lib at-spi2-atk at-spi2-core cups-libs gcompat libc6-compat

# Install Go
filename="go1.15.6.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "3918e6cc85e7eaaa6f859f1bdbaac772e7a825b0eb423c63d3ae68b21f84b844"
untar_file "/tmp/$filename"

# Install golangci-lint
GOLANGCILINT_VERSION=1.34.1
filename="golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64"
get_file "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/$filename.tar.gz" \
    "/tmp/${filename}.tar.gz" \
    "23e4a9d8f89729007c6d749c245f725c2dbcfb194f4099003f9b826f1d386ad1"
untar_file "/tmp/${filename}.tar.gz"
ln -s /usr/local/${filename}/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
chmod 755 /usr/local/bin/golangci-lint

# Install dependencies
apk add --no-cache fontconfig zip jq

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "b4138199aa755ebfe171b57cc46910b13258ace5fbc4eaa099c42607cd0bff32"
chmod +x /usr/local/bin/cc-test-reporter

curl -fL -o /usr/local/bin/grabpl "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v0.5.38/grabpl"

apk add --no-cache git
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
