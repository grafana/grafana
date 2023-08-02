import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { createDataFrame } from '@grafana/data';

import { ColorScheme } from '../types';

import FlameGraph from './FlameGraph';
import { FlameGraphDataContainer } from './dataTransform';
import { data } from './testData/dataNestedSet';

import 'jest-canvas-mock';

jest.mock('react-use', () => {
  const reactUse = jest.requireActual('react-use');
  return {
    ...reactUse,
    useMeasure: () => {
      const ref = React.useRef();
      return [ref, { width: 1600 }];
    },
  };
});

describe('FlameGraph', () => {
  function setup() {
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData);

    const setRangeMin = jest.fn();
    const setRangeMax = jest.fn();
    const onItemFocused = jest.fn();
    const onSandwich = jest.fn();
    const onFocusPillClick = jest.fn();
    const onSandwichPillClick = jest.fn();

    const renderResult = render(
      <FlameGraph
        data={container}
        rangeMin={0}
        rangeMax={1}
        search={''}
        setRangeMin={setRangeMin}
        setRangeMax={setRangeMax}
        onItemFocused={onItemFocused}
        textAlign={'left'}
        onSandwich={onSandwich}
        onFocusPillClick={onFocusPillClick}
        onSandwichPillClick={onSandwichPillClick}
        colorScheme={ColorScheme.ValueBased}
      />
    );
    return {
      renderResult,
      mocks: {
        setRangeMax,
        setRangeMin,
        onItemFocused,
        onSandwich,
        onFocusPillClick,
        onSandwichPillClick,
      },
    };
  }

  it('should render without error', async () => {
    setup();
  });

  it('should render correctly', async () => {
    setup();

    const canvas = screen.getByTestId('flameGraph') as HTMLCanvasElement;
    const ctx = canvas!.getContext('2d');
    const calls = ctx!.__getDrawCalls();
    expect(calls).toMatchSnapshot();
  });

  it('should render metadata', async () => {
    setup();
    expect(screen.getByText('16.5 Bil | 16.5 Bil samples (Count)')).toBeDefined();
  });

  it('should render context menu', async () => {
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'offsetX', { get: () => 10 });
    Object.defineProperty(event, 'offsetY', { get: () => 10 });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, value: 500 });

    setup();
    const canvas = screen.getByTestId('flameGraph') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();
    expect(screen.queryByTestId('contextMenu')).not.toBeInTheDocument();

    fireEvent(canvas, event);
    expect(screen.getByTestId('contextMenu')).toBeInTheDocument();
  });
});
