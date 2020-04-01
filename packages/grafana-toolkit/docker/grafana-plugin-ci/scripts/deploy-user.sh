#!/bin/bash
source "./deploy-common.sh"
mkdir -pv ${HOME}/plugin ${HOME}/go/bin ${HOME}/bin ${HOME}/src ${HOME}/tmp

# Install Mage
git clone https://github.com/magefile/mage.git ${HOME}/src/mage 
pushd /home/circleci/src/mage
go run bootstrap.go && /bin/rm -rf ${HOME}/src/mage
popd
