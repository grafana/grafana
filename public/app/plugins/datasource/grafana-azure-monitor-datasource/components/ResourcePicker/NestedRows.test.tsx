import { render, screen } from '@testing-library/react';
import React from 'react';
import NestedRows from './NestedRows';
import { ResourceRowType } from './types';

const defaultProps = {
  rows: [];
  level: number;
  selectedRows: ResourceRowGroup;
  requestNestedRows: (row: ResourceRow) => Promise<void>;
  onRowSelectedChange: (row: ResourceRow, selected: boolean) => void;
  selectableEntryTypes: ResourceRowType[];
};

describe('NestedEntry', () => {
  it('should be selectable', () => {
    render(<NestedRows {...defaultProps}/>);
    const box = screen.getByRole('checkbox');
    expect(box).toBeInTheDocument();
  });


});
