import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CoreApp, DataFrameView, MutableDataFrame } from '@grafana/data';

import FlameGraph from './FlameGraph/FlameGraph';
import { Item, nestedSetToLevels } from './FlameGraph/dataTransform';
import { data } from './FlameGraph/testData/dataNestedSet';
import FlameGraphHeader from './FlameGraphHeader';
import { TOP_TABLE_TOUR_CONTENT, FLAME_GRAPH_TOUR_CONTENT } from './FlameGraphTour';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { SelectedView } from './types';

describe('FlameGraphTour', () => {
  const flameGraphData = new MutableDataFrame(data);
  const dataView = new DataFrameView<Item>(flameGraphData);
  const levels = nestedSetToLevels(dataView);

  const FlameGraphHeaderWithProps = ({ app }: { app: CoreApp }) => {
    return (
      <FlameGraphHeader
        app={app}
        search={''}
        setSearch={jest.fn()}
        setTopLevelIndex={jest.fn()}
        setRangeMin={jest.fn()}
        setRangeMax={jest.fn()}
        selectedView={SelectedView.Both}
        setSelectedView={jest.fn()}
        containerWidth={1600}
      />
    );
  };

  const FlameGraphWithProps = () => {
    return (
      <>
        <FlameGraph
          data={flameGraphData}
          app={CoreApp.Explore}
          levels={levels}
          topLevelIndex={0}
          rangeMin={0}
          rangeMax={1}
          search={''}
          setTopLevelIndex={jest.fn()}
          setRangeMin={jest.fn()}
          setRangeMax={jest.fn()}
          selectedView={SelectedView.Both}
        />
      </>
    );
  };

  const FlameGraphTopTableWithProps = () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { value: 500 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { value: 500 });

    return (
      <>
        <FlameGraphTopTableContainer
          data={flameGraphData}
          app={CoreApp.Explore}
          totalLevels={levels.length}
          selectedView={SelectedView.Both}
          search={''}
          setSearch={jest.fn()}
          setTopLevelIndex={jest.fn()}
          setRangeMin={jest.fn()}
          setRangeMax={jest.fn()}
        />
      </>
    );
  };

  it('tour should auto start', async () => {
    render(<FlameGraphTopTableWithProps />);
    render(<FlameGraphWithProps />);
    render(<FlameGraphHeaderWithProps app={CoreApp.Explore} />);

    // Shows step two (top table) first as query editor (target of step one) is not rendered
    expect(screen.getByText(TOP_TABLE_TOUR_CONTENT)).toBeInTheDocument();
    expect(screen.queryByText(FLAME_GRAPH_TOUR_CONTENT)).not.toBeInTheDocument();

    const nextButton = screen.getByTitle('Next');
    expect(nextButton).toBeInTheDocument();
    await userEvent.click(nextButton);

    expect(screen.queryByText(TOP_TABLE_TOUR_CONTENT)).not.toBeInTheDocument();
    expect(screen.queryByText(FLAME_GRAPH_TOUR_CONTENT)).toBeInTheDocument();

    const lastButton = screen.getByTitle('Last');
    expect(lastButton).toBeInTheDocument();
    await userEvent.click(lastButton);

    expect(screen.queryByText(TOP_TABLE_TOUR_CONTENT)).not.toBeInTheDocument();
    expect(screen.queryByText(FLAME_GRAPH_TOUR_CONTENT)).not.toBeInTheDocument();
  });

  it('tour should open via button', async () => {
    render(<FlameGraphTopTableWithProps />);
    render(<FlameGraphWithProps />);
    render(<FlameGraphHeaderWithProps app={CoreApp.Explore} />);

    expect(screen.queryByText(TOP_TABLE_TOUR_CONTENT)).not.toBeInTheDocument();
    expect(screen.queryByText(FLAME_GRAPH_TOUR_CONTENT)).not.toBeInTheDocument();

    const showButton = screen.getByRole('button', { name: /Show tour/i });
    expect(showButton).toBeInTheDocument();
    await userEvent.click(showButton);

    expect(screen.queryByText(TOP_TABLE_TOUR_CONTENT)).toBeInTheDocument();
  });
});
