#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

cd $(dirname $0)

MINIO_LOCALHOST_PORT=9000

brew install velero

DATA_DIR="../../data"

mkdir -p $DATA_DIR/devenv-velero

cat > $DATA_DIR/devenv-velero/credentials-velero << EOF
[default]
aws_access_key_id = minio
aws_secret_access_key = minio123
EOF

kubectl apply -f 00-minio-deployment.yaml

velero install \
    --provider aws \
    --plugins velero/velero-plugin-for-aws:v1.2.1 \
    --bucket velero \
    --secret-file $DATA_DIR/devenv-velero/credentials-velero \
    --use-volume-snapshots=false \
    --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://minio.velero.svc:9000


MINIO_POD=$(kubectl get pods -n velero -l component=minio -o jsonpath='{.items[0].metadata.name}')
kubectl port-forward $MINIO_POD -n velero $MINIO_LOCALHOST_PORT:9000 &
kubectl patch -n velero backupstoragelocation default --type merge -p "{\"spec\":{\"config\":{\"publicUrl\":\"http://localhost:$MINIO_LOCALHOST_PORT\"}}}"
