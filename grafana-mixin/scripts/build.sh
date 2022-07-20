#!/bin/bash
set -eo pipefail

cd "$(dirname "$0")"/..

source ../.bingo/variables.env

${MIXTOOL} generate all mixin.libsonnet
