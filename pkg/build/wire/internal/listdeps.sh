#!/usr/bin/env bash
# Copyright 2019 The Wire Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

# To run this script manually to update alldeps:
#
# $ internal/listdeps.sh > internal/alldeps
#
# Important note: there are changes in module tooling behavior between go 1.11
# and go 1.12; please make sure to use the same version of Go as used by Github
# Actions (see .github/workflows/tests.yml) when updating the alldeps file.
go list -deps -f '{{with .Module}}{{.Path}}{{end}}' ./... | sort | uniq
