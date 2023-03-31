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

import { getAllByText, getByText, render } from '@testing-library/react';
import React from 'react';

import config from 'app/core/config';

import { NewTracePageHeader, TracePageHeaderProps } from './NewTracePageHeader';
import { trace } from './TracePageHeader.test';

const setup = (propOverrides?: TracePageHeaderProps) => {
  const defaultProps = {
    trace,
    timeZone: '',
    viewRange: { time: { current: [10, 20] as [number, number] } },
    updateNextViewRangeTime: () => {},
    updateViewRangeTime: () => {},
    ...propOverrides,
  };

  return render(<NewTracePageHeader {...defaultProps} />);
};

describe('NewTracePageHeader test', () => {
  it('should render the new trace header', () => {
    config.featureToggles.newTraceView = true;
    setup();

    const header = document.querySelector('header');
    const method = getByText(header!, 'POST');
    const status = getByText(header!, '200');
    const url = getByText(header!, '/v2/gamma/792edh2w897y2huehd2h89');
    const duration = getAllByText(header!, '2.36s');
    const timestampPart1 = getByText(header!, '2023-02-05 08:50');
    const timestampPart2 = getByText(header!, ':56.289');
    expect(method).toBeInTheDocument();
    expect(status).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(duration.length).toBe(2);
    expect(timestampPart1).toBeInTheDocument();
    expect(timestampPart2).toBeInTheDocument();
  });
});
