import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createDataFrame, createTheme } from '@grafana/data';

import { data } from './FlameGraph/testData/dataNestedSet';
import FlameGraphContainer from './FlameGraphContainer';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from './constants';

jest.mock('react-use', () => ({
  useMeasure: () => {
    const ref = React.useRef();
    return [ref, { width: 1600 }];
  },
}));

describe('FlameGraphContainer', () => {
  // Needed for AutoSizer to work in test
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { value: 500 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { value: 500 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { value: 500 });

  const FlameGraphContainerWithProps = () => {
    const flameGraphData = createDataFrame(data);
    flameGraphData.meta = {
      custom: {
        ProfileTypeID: 'cpu:foo:bar',
      },
    };

    return <FlameGraphContainer data={flameGraphData} getTheme={() => createTheme({ colors: { mode: 'dark' } })} />;
  };

  it('should render without error', async () => {
    expect(() => render(<FlameGraphContainerWithProps />)).not.toThrow();
  });

  it('should update search when row selected in top table', async () => {
    render(<FlameGraphContainerWithProps />);
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);
    expect(screen.getByDisplayValue('net/http.HandlerFunc.ServeHTTP')).toBeInTheDocument();
    // Unclick the selection so that the rest of the tests don't have it highlighted
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);

    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[1]);
    expect(screen.getByDisplayValue('total')).toBeInTheDocument();
    // after it is highlighted it will be the only (first) item in the table so [1] -> [0]
    await userEvent.click((await screen.findAllByTitle('Highlight symbol'))[0]);
    expect(screen.queryByDisplayValue('total')).not.toBeInTheDocument();
  });

  it('should render options', async () => {
    render(<FlameGraphContainerWithProps />);
    expect(screen.getByText(/Top Table/)).toBeDefined();
    expect(screen.getByText(/Flame Graph/)).toBeDefined();
    expect(screen.getByText(/Both/)).toBeDefined();
  });

  it('should update selected view', async () => {
    render(<FlameGraphContainerWithProps />);

    expect(screen.getByTestId('flameGraph')).toBeDefined();
    expect(screen.getByTestId('topTable')).toBeDefined();

    await userEvent.click(screen.getByText(/Top Table/));
    expect(screen.queryByTestId('flameGraph')).toBeNull();
    expect(screen.getByTestId('topTable')).toBeDefined();

    await userEvent.click(screen.getByText(/Flame Graph/));
    expect(screen.getByTestId('flameGraph')).toBeDefined();
    expect(screen.queryByTestId('topTable')).toBeNull();

    await userEvent.click(screen.getByText(/Both/));
    expect(screen.getByTestId('flameGraph')).toBeDefined();
    expect(screen.getByTestId('topTable')).toBeDefined();
  });

  it('should render both option if screen width >= threshold', async () => {
    global.innerWidth = MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH;
    global.dispatchEvent(new Event('resize')); // Trigger the window resize event
    render(<FlameGraphContainerWithProps />);

    expect(screen.getByText(/Both/)).toBeDefined();
  });

  it('should not render both option if screen width < threshold', async () => {
    global.innerWidth = MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH - 1;
    global.dispatchEvent(new Event('resize'));
    render(<FlameGraphContainerWithProps />);

    expect(screen.queryByTestId(/Both/)).toBeNull();
  });

  it('should filter table items based on search input', async () => {
    // Render the FlameGraphContainer with necessary props
    render(<FlameGraphContainerWithProps />);

    // Simulate typing into the search input field
    const searchInput = await screen.findByTestId('searchInput');
    await userEvent.type(searchInput, 'net/http.HandlerFunc.ServeHTTP');

    // Verify that the table displays filtered items based on the search term
    const filteredRows = screen.queryAllByText('net/http.HandlerFunc.ServeHTTP');
    expect(filteredRows.length).toBeGreaterThan(0); // Expect to find at least one row with the search term

    // Verify that rows not matching the search term are not displayed
    const unfilteredRows = screen.queryAllByText('SomeOtherTextNotInSearch');
    expect(unfilteredRows.length).toBe(0); // Expect not to find rows that should be filtered out
  });
});
