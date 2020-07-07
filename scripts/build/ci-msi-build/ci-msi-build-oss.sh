#!/bin/bash
set -e
WORKING_DIRECTORY=$(pwd)
# copy zip file to /tmp/dist
mkdir -p /tmp/dist
cp ./dist/*.zip /tmp/dist
echo "Contents of /tmp/dist"
ls -al /tmp/dist

# nssm download has been unreliable, use a cached copy of it
echo "Caching NSSM"
mkdir -p /tmp/cache
cp ./scripts/build/ci-msi-build/msigenerator/cache/nssm-2.24.zip /tmp/cache
# a build can be specified, which will be pulled down
#python3 generator/build.py --build 5.4.3
#echo "LIGHT config"
#ls -al /home/xclient/wix/light.exe.config
#cat /home/xclient/wix/light.exe.config
#cp ./scripts/build/ci-msi-build/oss/light.exe.config /home/xclient/wix/light.exe.config
#cat /home/xclient/wix/light.exe.config
cd ./scripts/build/ci-msi-build/msigenerator
echo "Building MSI"
python3 generator/build.py "$@"
chmod a+x /tmp/scratch/*.msi
echo "MSI: Copy to $WORKING_DIRECTORY/dist"
cp /tmp/scratch/*.msi "$WORKING_DIRECTORY/dist"
echo "MSI: Generate SHA256"
MSI_FILE=$(ls "$WORKING_DIRECTORY"/dist/*.msi)
SHA256SUM=$(sha256sum "$MSI_FILE" | cut -f1 -d' ')
echo "$SHA256SUM" > "$MSI_FILE.sha256"
echo "MSI: SHA256 file content:"
cat "$MSI_FILE.sha256"
echo "MSI: contents of $WORKING_DIRECTORY/dist"
ls -al "$WORKING_DIRECTORY/dist"
