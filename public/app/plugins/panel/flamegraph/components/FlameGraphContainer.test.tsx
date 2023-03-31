import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CoreApp, MutableDataFrame } from '@grafana/data';

import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from '../constants';

import { data } from './FlameGraph/testData/dataNestedSet';
import FlameGraphContainer from './FlameGraphContainer';

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
    const flameGraphData = new MutableDataFrame(data);
    flameGraphData.meta = {
      custom: {
        ProfileTypeID: 'cpu:foo:bar',
      },
    };

    return <FlameGraphContainer data={flameGraphData} app={CoreApp.Explore} />;
  };

  it('should render without error', async () => {
    expect(() => render(<FlameGraphContainerWithProps />)).not.toThrow();
  });

  it('should update search when row selected in top table', async () => {
    render(<FlameGraphContainerWithProps />);
    await userEvent.click((await screen.findAllByRole('row'))[1]);
    expect(screen.getByDisplayValue('net/http.HandlerFunc.ServeHTTP')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('row')[2]);
    expect(screen.getByDisplayValue('total')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('row')[2]);
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
});
