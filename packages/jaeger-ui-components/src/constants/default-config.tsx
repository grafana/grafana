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

import deepFreeze from 'deep-freeze';

import { FALLBACK_DAG_MAX_NUM_SERVICES } from './index';

export default deepFreeze(
  Object.defineProperty(
    {
      archiveEnabled: false,
      dependencies: {
        dagMaxNumServices: FALLBACK_DAG_MAX_NUM_SERVICES,
        menuEnabled: true,
      },
      linkPatterns: [],
      menu: [
        {
          label: 'About Jaeger',
          items: [
            {
              label: 'GitHub',
              url: 'https://github.com/uber/jaeger',
            },
            {
              label: 'Docs',
              url: 'http://jaeger.readthedocs.io/en/latest/',
            },
            {
              label: 'Twitter',
              url: 'https://twitter.com/JaegerTracing',
            },
            {
              label: 'Discussion Group',
              url: 'https://groups.google.com/forum/#!forum/jaeger-tracing',
            },
            {
              label: 'Gitter.im',
              url: 'https://gitter.im/jaegertracing/Lobby',
            },
            {
              label: 'Blog',
              url: 'https://medium.com/jaegertracing/',
            },
          ],
        },
      ],
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
  )
);

export const deprecations = [
  {
    formerKey: 'dependenciesMenuEnabled',
    currentKey: 'dependencies.menuEnabled',
  },
  {
    formerKey: 'gaTrackingID',
    currentKey: 'tracking.gaID',
  },
];
