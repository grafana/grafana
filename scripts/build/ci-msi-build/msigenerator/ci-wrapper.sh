#!/bin/bash

# Build will be found in ./dist and ./dist-enterprise
# integrated circleci will have all of the code in /master
# and the builds will be found in $HOME
mkdir -p /tmp/dist
if [ -d '/home/xclient/repo/dist/' ]; then
  ls -al /home/xclient/repo/dist/
  cp /home/xclient/repo/dist/*.zip /tmp/dist/
  echo "Contents of /tmp/dist"
  ls -al /tmp/dist
fi
# nssm download has been unreliable, use a cached copy of it
echo "Caching NSSM"
mkdir -p /tmp/cache
cp /master/cache/nssm-2.24.zip /tmp/cache
# a build can be specified, which will be pulled down
#python3 generator/build.py --build 5.4.3
echo "LIGHT config"
ls -al /home/xclient/wix/light.exe.config
cat /home/xclient/wix/light.exe.config
cp /master/light.exe.config /home/xclient/wix/light.exe.config
cat /home/xclient/wix/light.exe.config
cd /master || exit 1
echo "Building MSI"
python3 generator/build.py "$@"
#
#
