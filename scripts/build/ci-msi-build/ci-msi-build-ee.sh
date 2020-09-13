#!/bin/bash
set -e
WORKING_DIRECTORY=$(pwd)
DIST_DIRECTORY="$WORKING_DIRECTORY/enterprise-dist"
# copy zip file to /tmp/dist
mkdir -p /tmp/dist
cp ./enterprise-dist/*.zip /tmp/dist
echo "Contents of /tmp/dist"
ls -al /tmp/dist

# nssm download has been unreliable, use a cached copy of it
echo "Caching NSSM"
mkdir -p /tmp/cache
cp ./scripts/build/ci-msi-build/msigenerator/cache/nssm-2.24.zip /tmp/cache

cd ./scripts/build/ci-msi-build/msigenerator
echo "Building MSI"
python3 generator/build.py "$@"
chmod a+x /tmp/scratch/*.msi
echo "MSI: Copy to $DIST_DIRECTORY"
cp /tmp/scratch/*.msi "$DIST_DIRECTORY"
echo "MSI: Generate SHA256"
MSI_FILE=$(ls "${DIST_DIRECTORY}"/*.msi)
SHA256SUM=$(sha256sum "$MSI_FILE" | cut -f1 -d' ')
echo "$SHA256SUM" > "$MSI_FILE.sha256"
echo "MSI: SHA256 file content:"
cat "$MSI_FILE.sha256"
echo "MSI: contents of $DIST_DIRECTORY"
ls -al "$DIST_DIRECTORY"
