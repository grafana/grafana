import { render, screen } from '@testing-library/react';
import React from 'react';
import NestedRow from './NestedRow';
import { ResourceRowType } from './types';

const defaultProps = {
  row: [],
  level: 0,
  selectedRows: [],
  requestNestedRows: jest.fn(),
  onRowSelectedChange: jest.fn(),
  selectableEntryTypes: [],
};

describe('NestedRow', () => {
  it('should be selectable', () => {
    render(<NestedRow {...defaultProps} />);
    const box = screen.getByRole('checkbox');
    expect(box).toBeInTheDocument();
  });
});
