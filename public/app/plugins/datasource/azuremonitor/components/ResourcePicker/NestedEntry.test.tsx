import { render, screen } from '@testing-library/react';
import React from 'react';

import { NestedEntry } from './NestedEntry';
import { ResourceRowType } from './types';

const defaultProps = {
  level: 0,
  entry: { id: '123', uri: 'someuri', name: '123', type: ResourceRowType.Resource, typeLabel: '' },
  isSelected: false,
  isSelectable: false,
  isOpen: false,
  isDisabled: false,
  scrollIntoView: false,
  onToggleCollapse: jest.fn(),
  onSelectedChange: jest.fn(),
};

describe('NestedEntry', () => {
  it('should be selectable', () => {
    render(<NestedEntry {...defaultProps} isSelectable={true} />);
    const box = screen.getByRole('checkbox');
    expect(box).toBeInTheDocument();
  });

  it('should not be selectable', () => {
    render(<NestedEntry {...defaultProps} />);
    const box = screen.queryByRole('checkbox');
    expect(box).not.toBeInTheDocument();
  });
});
