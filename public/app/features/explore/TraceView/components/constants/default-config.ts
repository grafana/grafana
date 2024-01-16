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

import { FALLBACK_DAG_MAX_NUM_SERVICES } from './index';

export default Object.defineProperty(
  {
    archiveEnabled: false,
    dependencies: {
      dagMaxNumServices: FALLBACK_DAG_MAX_NUM_SERVICES,
      menuEnabled: true,
    },
    linkPatterns: [],
    search: {
      maxLookback: {
        label: '2 Days',
        value: '2d',
      },
      maxLimit: 1500,
    },
    tracking: {
      gaID: null,
      trackErrors: true,
    },
  },
  // fields that should be individually merged vs wholesale replaced
  '__mergeFields',
  { value: ['dependencies', 'search', 'tracking'] }
);
