import { screen } from '@testing-library/dom';
import { render } from '@testing-library/react';
import React, { useState } from 'react';

import { CoreApp, DataFrameView, MutableDataFrame } from '@grafana/data';

import { SelectedView } from '../types';

import FlameGraph from './FlameGraph';
import { Item, nestedSetToLevels } from './dataTransform';
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
    const [rangeMin, setRangeMin] = useState(0);
    const [rangeMax, setRangeMax] = useState(1);
    const [search] = useState('');
    const [selectedView, _] = useState(SelectedView.Both);

    const flameGraphData = new MutableDataFrame(data);
    const dataView = new DataFrameView<Item>(flameGraphData);
    const levels = nestedSetToLevels(dataView);

    return (
      <FlameGraph
        data={flameGraphData}
        app={CoreApp.Explore}
        levels={levels}
        topLevelIndex={topLevelIndex}
        rangeMin={rangeMin}
        rangeMax={rangeMax}
        search={search}
        setTopLevelIndex={setTopLevelIndex}
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
});
