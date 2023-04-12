import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';

import { CoreApp, MutableDataFrame } from '@grafana/data';

import { SelectedView } from '../types';

import FlameGraph from './FlameGraph';
import { FlameGraphDataContainer, nestedSetToLevels } from './dataTransform';
import { data } from './testData/dataNestedSet';

import 'jest-canvas-mock';

jest.mock('react-use', () => ({
  useMeasure: () => {
    const ref = React.useRef();
    return [ref, { width: 1600 }];
  },
}));

describe('FlameGraph', () => {
  const FlameGraphWithProps = () => {
    const [topLevelIndex, setTopLevelIndex] = useState(0);
    const [selectedBarIndex, setSelectedBarIndex] = useState(0);
    const [rangeMin, setRangeMin] = useState(0);
    const [rangeMax, setRangeMax] = useState(1);
    const [search] = useState('');
    const [selectedView, _] = useState(SelectedView.Both);

    const flameGraphData = new MutableDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData);
    const levels = nestedSetToLevels(container);

    return (
      <FlameGraph
        data={container}
        app={CoreApp.Explore}
        levels={levels}
        topLevelIndex={topLevelIndex}
        selectedBarIndex={selectedBarIndex}
        rangeMin={rangeMin}
        rangeMax={rangeMax}
        search={search}
        setTopLevelIndex={setTopLevelIndex}
        setSelectedBarIndex={setSelectedBarIndex}
        setRangeMin={setRangeMin}
        setRangeMax={setRangeMax}
        selectedView={selectedView}
      />
    );
  };

  it('should render without error', async () => {
    expect(() => render(<FlameGraphWithProps />)).not.toThrow();
  });

  it('should render correctly', async () => {
    render(<FlameGraphWithProps />);

    const canvas = screen.getByTestId('flameGraph') as HTMLCanvasElement;
    const ctx = canvas!.getContext('2d');
    const calls = ctx!.__getDrawCalls();
    expect(calls).toMatchSnapshot();
  });

  it('should render metadata', async () => {
    render(<FlameGraphWithProps />);
    expect(screen.getByText('16.5 Bil (100%) of 16,460,000,000 total samples (Count)')).toBeDefined();
  });

  it('should render context menu', async () => {
    const event = new MouseEvent('click');
    Object.defineProperty(event, 'offsetX', { get: () => 10 });
    Object.defineProperty(event, 'offsetY', { get: () => 10 });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    const screen = render(<FlameGraphWithProps />);
    const canvas = screen.getByTestId('flameGraph') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();
    expect(screen.queryByTestId('contextMenu')).not.toBeInTheDocument();
    fireEvent(canvas, event);
    expect(screen.getByTestId('contextMenu')).toBeInTheDocument();
  });
});
