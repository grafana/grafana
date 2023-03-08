import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { KeyboardEvent } from 'react';
import { Observable } from 'rxjs';

import { ArrayVector, DataFrame, DataFrameView, FieldType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { DashboardQueryResult, QueryResponse } from '../../service';
import { DashboardSearchItemType } from '../../types';

import { SearchResultsGrid } from './SearchResultsGrid';

describe('SearchResultsGrid', () => {
  const dashboardsData: DataFrame = {
    fields: [
      {
        name: 'kind',
        type: FieldType.string,
        config: {},
        values: new ArrayVector([DashboardSearchItemType.DashDB]),
      },
      { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector(['My dashboard 1', 'dash2']) },
      { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector(['my-dashboard-1', 'dash-2']) },
      { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector(['/my-dashbaord-1', '/dash-2']) },
    ],
    length: 2,
  };
  const mockSearchResult: QueryResponse = {
    isItemLoaded: jest.fn(),
    loadMoreItems: jest.fn(),
    totalRows: dashboardsData.length,
    view: new DataFrameView<DashboardQueryResult>(dashboardsData),
  };

  const baseProps = {
    response: mockSearchResult,
    width: 800,
    height: 600,
    clearSelection: jest.fn(),
    onTagSelected: jest.fn(),
    keyboardEvents: new Observable<KeyboardEvent<Element>>(),
  };

  it('should render grid of dashboards', () => {
    render(<SearchResultsGrid {...baseProps} />);
    expect(screen.getByTestId(selectors.components.Search.dashboardCard('My dashboard 1'))).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Search.dashboardCard('dash2'))).toBeInTheDocument();
  });

  it('should not render checkboxes for non-editable results', async () => {
    render(<SearchResultsGrid {...baseProps} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
  });

  it('should render checkboxes for editable results ', async () => {
    const mockSelectionToggle = jest.fn();
    const mockSelection = jest.fn();
    render(<SearchResultsGrid {...baseProps} selection={mockSelection} selectionToggle={mockSelectionToggle} />);

    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(2));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Select dashboard dash2/i }));
    expect(mockSelectionToggle).toHaveBeenCalledWith('dashboard', 'dash-2');
    expect(mockSelectionToggle).toHaveBeenCalledTimes(1);
  });
});
