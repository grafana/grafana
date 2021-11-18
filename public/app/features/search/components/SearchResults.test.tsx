import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectors } from '@grafana/e2e-selectors';

import { Props, SearchResults } from './SearchResults';
import { generalFolder, searchResults } from '../testData';
import { SearchLayout } from '../types';

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
    expect(screen.getAllByTestId(selectors.components.Search.collapseFolder('0'))).toHaveLength(1);
    expect(screen.getAllByTestId(selectors.components.Search.itemsV2)).toHaveLength(1);
    expect(screen.getAllByTestId(selectors.components.Search.dashboardItem('Test 1'))).toHaveLength(1);
    expect(screen.getAllByTestId(selectors.components.Search.dashboardItem('Test 2'))).toHaveLength(1);
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

    fireEvent.click(screen.getByTestId(selectors.components.Search.collapseFolder('0')));
    expect(mockOnToggleSection).toHaveBeenCalledTimes(1);
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
