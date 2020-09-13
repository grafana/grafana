import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchItem, Props } from './SearchItem';
import { DashboardSearchItemType } from '../types';

beforeEach(() => {
  jest.clearAllMocks();
});

const data = {
  id: 1,
  uid: 'lBdLINUWk',
  title: 'Test 1',
  uri: 'db/test1',
  url: '/d/lBdLINUWk/test1',
  slug: '',
  type: DashboardSearchItemType.DashDB,
  tags: ['Tag1', 'Tag2'],
  isStarred: false,
  checked: false,
};

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    item: data,
    onTagSelected: jest.fn(),
    editable: false,
  };

  Object.assign(props, propOverrides);

  render(<SearchItem {...props} />);
};

describe('SearchItem', () => {
  it('should render the item', () => {
    setup();
    expect(screen.getAllByLabelText('Dashboard search item Test 1')).toHaveLength(1);
    expect(screen.getAllByText('Test 1')).toHaveLength(1);
  });

  it('should mark item as checked', () => {
    const mockedOnToggleChecked = jest.fn();
    setup({ editable: true, onToggleChecked: mockedOnToggleChecked });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(mockedOnToggleChecked).toHaveBeenCalledTimes(1);
    expect(mockedOnToggleChecked).toHaveBeenCalledWith(data);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it("should render item's tags", () => {
    setup();
    expect(screen.getAllByText(/tag/i)).toHaveLength(2);
  });

  it('should select the tag on tag click', () => {
    const mockOnTagSelected = jest.fn();
    setup({ onTagSelected: mockOnTagSelected });
    fireEvent.click(screen.getByText('Tag1'));
    expect(mockOnTagSelected).toHaveBeenCalledTimes(1);
    expect(mockOnTagSelected).toHaveBeenCalledWith('Tag1');
  });
});
