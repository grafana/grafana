#!/bin/bash
WORKING_DIRECTORY=`pwd`
# copy oss files to /master
mkdir -p /tmp/dist
cp ./dist/*.zip /tmp/dist
echo "Contents of /tmp/dist"
ls -al /tmp/dist
mkdir -p /master
cp -r ./scripts/build/ci-msi-build/oss /master
echo "Contents of /master"
ls -al /master

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
cd /master
echo "Building MSI"
python3 generator/build.py "$@"
chmod a+x /tmp/a/*.msi
echo "MSI: Copy to $WORKING_DIRECTORY/dist"
cp /tmp/a/*.msi $WORKING_DIRECTORY/dist
echo "MSI: contents of $WORKING_DIRECTORY/dist"
ls -al $WORKING_DIRECTORY/dist
