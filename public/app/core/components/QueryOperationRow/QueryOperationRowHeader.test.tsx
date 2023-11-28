import { render, screen } from '@testing-library/react';
import React from 'react';

import { QueryOperationRowHeader, QueryOperationRowHeaderProps } from './QueryOperationRowHeader';

const setup = (propOverrides?: Partial<QueryOperationRowHeaderProps>) => {
  const props: QueryOperationRowHeaderProps = {
    title: 'test-title',
    draggable: true,
    isContentVisible: true,
    id: 'test-id',
    onRowToggle: jest.fn(),
    reportDragMousePosition: jest.fn(),
    ...propOverrides,
  };
  return render(<QueryOperationRowHeader {...props}></QueryOperationRowHeader>);
};

describe('QueryOperationRowHeader', () => {
  test('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  describe('collapsable property', () => {
    test('should show the button to collapse the query row by default', () => {
      setup();
      expect(screen.getByLabelText('Collapse query row')).toBeInTheDocument();
    });
    test('should hide the button to collapse the query row when collapsable is set as false', () => {
      setup({ collapsable: false });
      expect(screen.queryByLabelText('Collapse query row')).not.toBeInTheDocument();
    });
  });
});
