import { render, screen } from '@testing-library/react';
import React from 'react';
import NestedRow from './NestedRow';
import { ResourceRowType } from './types';

const defaultProps = {
  row: {
    id: '1',
    name: '1',
    type: ResourceRowType.Resource,
    typeLabel: '1',
  },
  level: 0,
  selectedRows: [],
  requestNestedRows: jest.fn(),
  onRowSelectedChange: jest.fn(),
  selectableEntryTypes: [],
};

describe('NestedRow', () => {
  it('should be selectable', () => {
    render(<NestedRow {...defaultProps} />);
  });
});
