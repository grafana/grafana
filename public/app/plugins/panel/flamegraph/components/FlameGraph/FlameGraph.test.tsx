import { screen } from '@testing-library/dom';
import { render } from '@testing-library/react';
import React, { useState } from 'react';

import { CoreApp, DataFrameView, MutableDataFrame } from '@grafana/data';

import { FlameGraphScale, SelectedView } from '../types';

import FlameGraph from './FlameGraph';
import { Item, nestedSetToLevels } from './dataTransform';
import { data } from './testData/dataNestedSet';
import 'jest-canvas-mock';

describe('FlameGraph', () => {
  const FlameGraphWithProps = () => {
    const [topLevelIndex, setTopLevelIndex] = useState(0);
    const [rangeMin, setRangeMin] = useState(0);
    const [rangeMax, setRangeMax] = useState(1);
    const [search] = useState('');
    const [flameGraphScale, setFlameGraphScale] = useState<FlameGraphScale[]>([]);
    const [selectedView, __] = useState(SelectedView.Both);

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
        flameGraphScale={flameGraphScale}
        setScale={() => {
          setFlameGraphScale(scaleObject);
        }}
        selectedView={selectedView}
        sizeRef={jest.fn()}
        containerWidth={1600}
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

    // renders scale
    expect(screen.getByText('293')).toBeTruthy();
    expect(screen.getByText('586')).toBeTruthy();
    expect(screen.getByText('1.14 GiB')).toBeTruthy();
  });
});

const scaleObject = [
  {
    text: '0',
    showText: true,
    width: 0,
  },
  {
    text: '146',
    showText: false,
    width: 32,
  },
  {
    text: '293',
    showText: true,
    width: 32,
  },
  {
    text: '439',
    showText: false,
    width: 32,
  },
  {
    text: '586',
    showText: true,
    width: 32,
  },
  {
    text: '732',
    showText: false,
    width: 32,
  },
  {
    text: '878',
    showText: false,
    width: 32,
  },
  {
    text: '1.00',
    showText: false,
    width: 32,
  },
  {
    text: '1.14  GiB',
    showText: true,
    width: 32,
  },
];
