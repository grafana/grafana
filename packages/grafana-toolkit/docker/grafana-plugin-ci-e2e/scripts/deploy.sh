#!/bin/bash
source "/etc/profile"
source "./deploy-slim.sh"
source "./deploy-common.sh"

NODEVER="v12.16.2-linux-x64"
# Install Node
wget -O - "https://nodejs.org/dist/v12.16.2/node-${NODEVER}.tar.xz" | tar Jvxf - -C "/tmp"

# Move node to /usr/local so it's in the path
pushd /tmp/node-${NODEVER}
/bin/rm -f CHANGELOG.md README.md LICENSE
/bin/cp -r * /usr/local
/bin/cp -r .??* /usr/local
popd
/bin/rm -rf /tmp/node-${NODEVER}

# Resource the profile so we know our path is being honoured
source "/etc/profile"
# Install Yarn. Not in the path yet so fully qualified
npm i -g yarn

# Install Go
filename="go1.14.linux-amd64.tar.gz"
get_file "https://dl.google.com/go/$filename" "/tmp/$filename" "08df79b46b0adf498ea9f320a0f23d6ec59e9003660b4c9c1ce8e5e2c6f823ca"
untar_file "/tmp/$filename"


# Install golangci-lint
filename="golangci-lint-1.23.7-linux-amd64.tar.gz"
get_file "https://github.com/golangci/golangci-lint/releases/download/v1.23.7/$filename" \
    "/tmp/$filename" \
    "34df1794a2ea8e168b3c98eed3cc0f3e13ed4cba735e4e40ef141df5c41bc086"
untar_file "/tmp/$filename"
chmod 755 /usr/local/bin/golangci-lint
ln -s /usr/local/golangci-lint-1.23.7-linux-amd64/golangci-lint /usr/local/bin/golangci-lint
ln -s /usr/local/go/bin/go /usr/local/bin/go
ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt

# Install code climate
get_file "https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64" \
    "/usr/local/bin/cc-test-reporter" \
    "38f2442892027f61a07f52c845818750261b2ba58bffb043a582495339d37c05"
chmod 755 /usr/local/bin/cc-test-reporter

# Install Mage
mkdir -pv /tmp/mage $HOME/go/bin
git clone https://github.com/magefile/mage.git /tmp/mage
pushd /tmp/mage && go run bootstrap.go && popd
mv $HOME/go/bin/mage /usr/local/bin
# Cleanup after yourself
/bin/rm -rf /tmp/mage 
/bin/rm -rf $HOME/go

# Get the size down
/bin/rm -rf /var/lib/apt/lists
