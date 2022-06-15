import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { generalFolder, searchResults } from '../testData';
import { SearchLayout } from '../types';

import { Props, SearchResults } from './SearchResults';

beforeEach(() => {
  jest.clearAllMocks();
});

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    results: searchResults,
    onTagSelected: (name: string) => {},
    onToggleSection: () => {},
    editable: false,
    layout: SearchLayout.Folders,
  };

  Object.assign(props, propOverrides);

  render(<SearchResults {...props} />);
};

describe('SearchResults', () => {
  it('should render result items', () => {
    setup();
    expect(screen.getAllByTestId(selectors.components.Search.sectionV2)).toHaveLength(2);
  });

  it('should render section items for expanded section', () => {
    setup();
    expect(screen.getAllByText('General', { exact: false })[0]).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Search.itemsV2)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Search.dashboardItem('Test 1'))).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Search.dashboardItem('Test 2'))).toBeInTheDocument();

    // Check search cards aren't in the DOM
    expect(screen.queryByTestId(selectors.components.Search.cards)).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Search.dashboardCard('Test 1'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Search.dashboardCard('Test 2'))).not.toBeInTheDocument();
  });

  it('should render search card items for expanded section when showPreviews is enabled', () => {
    setup({ showPreviews: true });
    expect(screen.getAllByText('General', { exact: false })[0]).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Search.cards)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Search.dashboardCard('Test 1'))).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.Search.dashboardCard('Test 2'))).toBeInTheDocument();

    // Check search items aren't in the DOM
    expect(screen.queryByTestId(selectors.components.Search.itemsV2)).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Search.dashboardItem('Test 1'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Search.dashboardItem('Test 2'))).not.toBeInTheDocument();
  });

  it('should not render checkboxes for non-editable results', () => {
    setup({ editable: false });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('should render checkboxes for editable results', () => {
    setup({ editable: true });
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('should collapse folder item list on header click', () => {
    const mockOnToggleSection = jest.fn();
    setup({ onToggleSection: mockOnToggleSection });

    fireEvent.click(screen.getAllByText('General', { exact: false })[0]);
    expect(mockOnToggleSection).toHaveBeenCalledWith(generalFolder);
  });

  it('should not throw an error if the search results have an empty title', () => {
    const mockOnToggleSection = jest.fn();
    const searchResultsEmptyTitle = searchResults.slice();
    searchResultsEmptyTitle[0].title = '';
    expect(() => {
      setup({ results: searchResultsEmptyTitle, onToggleSection: mockOnToggleSection });
    }).not.toThrowError();
  });
});
