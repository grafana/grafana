#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

cd $(dirname $0)

MINIO_LOCALHOST_PORT=9000

brew install velero
brew install minio/stable/mc

DATA_DIR="../../data"

mkdir -p $DATA_DIR/devenv-velero

cat > $DATA_DIR/devenv-velero/credentials-velero << EOF
[default]
aws_access_key_id = minio
aws_secret_access_key = minio123
EOF

velero install \
    --provider aws \
    --plugins velero/velero-plugin-for-aws:v1.2.1 \
    --bucket velero \
    --secret-file $DATA_DIR/devenv-velero/credentials-velero \
    --use-volume-snapshots=false \
    --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://minio.velero.svc:9000

# Tilt will set up the port-forward
kubectl patch -n velero backupstoragelocation default --type merge -p "{\"spec\":{\"config\":{\"publicUrl\":\"http://localhost:$MINIO_LOCALHOST_PORT\"}}}"
