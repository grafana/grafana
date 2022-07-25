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

import { render, screen } from '@testing-library/react';
import React from 'react';

import traceGenerator from '../demo/trace-generators';
import { getTraceName } from '../model/trace-viewer';
import transformTraceData from '../model/transform-trace-data';

import TracePageHeader from './TracePageHeader';

const trace = transformTraceData(traceGenerator.trace({}));
const setup = (propOverrides) => {
  const defaultProps = {
    trace,
    hideMap: false,
    showArchiveButton: false,
    showShortcutsHelp: false,
    showStandaloneLink: false,
    showViewOptions: false,
    textFilter: '',
    viewRange: { time: { current: [10, 20] } },
    updateTextFilter: () => {},
    ...propOverrides,
  };

  return render(<TracePageHeader {...defaultProps} />);
};

describe('TracePageHeader test', () => {
  it('should render a header ', () => {
    setup();

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('should render nothing if a trace is not present', () => {
    setup({ trace: null });

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { traceName: getTraceName(trace.spans) })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByText(/Reset Selection/)).not.toBeInTheDocument();
  });

  it('should render the trace title', () => {
    setup();

    expect(screen.getByRole('heading', { traceName: getTraceName(trace.spans) })).toBeInTheDocument();
  });

  it('should render the header items', () => {
    setup();

    const headerItems = screen.queryAllByRole('listitem');

    expect(headerItems).toHaveLength(5);
    //                                                        Year-month-day hour-minute-second
    expect(headerItems[0].textContent.match(/Trace Start:\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}/g)).toBeTruthy();
    expect(headerItems[1].textContent.match(/Duration:[\d|\.][\.|\d|s][\.|\d|s]?[\d]?/)).toBeTruthy();
    expect(headerItems[2].textContent.match(/Services:\d\d?/g)).toBeTruthy();
    expect(headerItems[3].textContent.match(/Depth:\d\d?/)).toBeTruthy();
    expect(headerItems[4].textContent.match(/Total Spans:\d\d?\d?\d?/)).toBeTruthy();
  });

  it('should render a <SpanGraph>', () => {
    setup();

    expect(screen.getByText(/Reset Selection/)).toBeInTheDocument();
  });

  describe('observes the visibility toggles for various UX elements', () => {
    it('hides the minimap when hideMap === true', () => {
      setup({ hideMap: true });

      expect(screen.queryByText(/Reset Selection/)).not.toBeInTheDocument();
    });

    it('hides the summary when hideSummary === true', () => {
      const { rerender } = setup({ hideSummary: false });
      expect(screen.queryAllByRole('listitem')).toHaveLength(5);

      rerender(<TracePageHeader hideSummary={false} trace={null} />);
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);

      rerender(
        <TracePageHeader
          trace={trace}
          hideSummary={true}
          hideMap={false}
          showArchiveButton={false}
          showShortcutsHelp={false}
          showStandaloneLink={false}
          showViewOptions={false}
          textFilter=""
          viewRange={{ time: { current: [10, 20] } }}
          updateTextFilter={() => {}}
        />
      );
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);

      rerender(
        <TracePageHeader
          trace={trace}
          hideSummary={false}
          hideMap={false}
          showArchiveButton={false}
          showShortcutsHelp={false}
          showStandaloneLink={false}
          showViewOptions={false}
          textFilter=""
          viewRange={{ time: { current: [10, 20] } }}
          updateTextFilter={() => {}}
        />
      );
      expect(screen.queryAllByRole('listitem')).toHaveLength(5);
    });
  });
});
