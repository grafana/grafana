import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResults, Props } from './SearchResults';
import { searchResults, generalFolder } from '../testData';
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
    expect(screen.getAllByLabelText('Search section')).toHaveLength(2);
  });

  it('should render section items for expanded section', () => {
    setup();
    expect(screen.getAllByLabelText(/collapse folder/i)).toHaveLength(1);
    expect(screen.getAllByLabelText('Search items')).toHaveLength(1);
    expect(screen.getAllByLabelText(/dashboard search item/i)).toHaveLength(2);
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

    fireEvent.click(screen.getByLabelText('Collapse folder 0'));
    expect(mockOnToggleSection).toHaveBeenCalledTimes(1);
    expect(mockOnToggleSection).toHaveBeenCalledWith(generalFolder);
  });
});
