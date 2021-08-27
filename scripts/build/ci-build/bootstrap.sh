#!/bin/bash

cd /tmp || exit 1
tar xfJ x86_64-centos6-linux-gnu.tar.xz
tar xfJ osxcross.tar.xz
#
# Add kerberos libs and headers, copy headers to expected path
export PATH=$PATH:/tmp/osxcross/target/bin
export MACOSX_DEPLOYMENT_TARGET=10.15
export OSXCROSS_MACPORTS_MIRROR=packages.macports.org
osxcross-macports install kerberos5
osxcross-macports install heimdal
mkdir -p /usr/local/opt/heimdal/include
cp -r /tmp/osxcross/target/macports/pkgs/opt/local/libexec/heimdal/include/* /usr/local/opt/heimdal/include/
