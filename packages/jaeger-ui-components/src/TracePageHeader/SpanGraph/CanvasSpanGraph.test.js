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

import { render } from '@testing-library/react';
import React from 'react';

import { createTheme } from '@grafana/data';

import { UnthemedCanvasSpanGraph } from './CanvasSpanGraph';

describe('CanvasSpanGraph tests', () => {
  it('renders without exploding', () => {
    expect(() =>
      render(<UnthemedCanvasSpanGraph items={items} valueWidth={4000} theme={createTheme()} />)
    ).not.toThrow();
  });
});

const items = [
  {
    valueWidth: 1,
    valueOffset: 1,
    serviceName: 'service-name-0',
  },
];
