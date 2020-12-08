#!/bin/bash
set -eo pipefail

cd "$(dirname "$0")"/..

mixtool generate all mixin.libsonnet
