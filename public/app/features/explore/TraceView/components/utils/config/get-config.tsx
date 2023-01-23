// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { get as _get } from 'lodash';

import defaultConfig from '../../constants/default-config';

/**
 * Merge the embedded config from the query service (if present) with the
 * default config from `../../constants/default-config`.
 */
export default function getConfig() {
  return defaultConfig;
}

export function getConfigValue(path: string) {
  return _get(getConfig(), path);
}
