import { render, screen } from '@testing-library/react';
import userEvents from '@testing-library/user-event';
import React from 'react';

import { CoreApp, createDataFrame } from '@grafana/data';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';

import FlameGraphTopTableContainer from './FlameGraphTopTableContainer';

describe('FlameGraphTopTableContainer', () => {
  const setup = () => {
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData);
    const onSearch = jest.fn();
    const onSandwich = jest.fn();

    const renderResult = render(
      <FlameGraphTopTableContainer
        data={container}
        app={CoreApp.Explore}
        onSymbolClick={jest.fn()}
        onSearch={onSearch}
        onSandwich={onSandwich}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render correctly', async () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 500 });

    setup();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(16);

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(3);
    expect(columnHeaders[0].textContent).toEqual('Symbol');
    expect(columnHeaders[1].textContent).toEqual('Self');
    expect(columnHeaders[2].textContent).toEqual('Total');

    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(45); // 16 rows
    expect(cells[0].textContent).toEqual('net/http.HandlerFunc.ServeHTTP');
    expect(cells[1].textContent).toEqual('31.7 K');
    expect(cells[2].textContent).toEqual('31.7 Bil');
    expect(cells[24].textContent).toEqual('test/pkg/create.(*create).initServer.func2.1');
    expect(cells[25].textContent).toEqual('5.58 K');
    expect(cells[26].textContent).toEqual('5.58 Bil');
  });

  it('should render search and sandwich buttons', async () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 500 });

    const { mocks } = setup();

    const searchButtons = screen.getAllByLabelText(/Search for symbol/);
    expect(searchButtons.length > 0).toBeTruthy();
    await userEvents.click(searchButtons[0]);

    expect(mocks.onSearch).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');

    const sandwichButtons = screen.getAllByLabelText(/Show in sandwich view/);
    expect(sandwichButtons.length > 0).toBeTruthy();
    await userEvents.click(sandwichButtons[0]);

    expect(mocks.onSandwich).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');
  });
});
