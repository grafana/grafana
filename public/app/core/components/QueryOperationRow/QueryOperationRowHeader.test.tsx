import { render, screen } from '@testing-library/react';

import { QueryOperationRowHeader, type QueryOperationRowHeaderProps } from './QueryOperationRowHeader';

const setup = (propOverrides?: Partial<QueryOperationRowHeaderProps>) => {
  const props: QueryOperationRowHeaderProps = {
    title: 'test-title',
    draggable: true,
    isContentVisible: true,
    id: 'test-id',
    onRowToggle: jest.fn(),
    ...propOverrides,
  };
  return render(<QueryOperationRowHeader {...props}></QueryOperationRowHeader>);
};

describe('QueryOperationRowHeader', () => {
  test('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  describe('drag handle', () => {
    test('should carry its own accessible name rather than relying on the icon', () => {
      setup();
      expect(screen.getByLabelText('Drag and drop to reorder')).toBeInTheDocument();
    });
    test('should not render the drag handle when the row is not draggable', () => {
      setup({ draggable: false });
      expect(screen.queryByLabelText('Drag and drop to reorder')).not.toBeInTheDocument();
    });
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
