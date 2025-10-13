#!/bin/sh

influx v1 dbrp create --bucket-id "${DOCKER_INFLUXDB_INIT_BUCKET_ID}" --org myorg --db mybucket --rp default --default