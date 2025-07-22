import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BulkActionFailureBanner, MoveResultFailed } from './BulkActionFailureBanner';

const setup = (resultOverrides?: Array<Partial<MoveResultFailed>>, onDismissOverride?: () => void) => {
  const defaultFailedItems: MoveResultFailed[] = [
    {
      status: 'failed',
      title: 'Dashboard 1',
      errorMessage: 'Permission denied',
    },
    {
      status: 'failed',
      title: 'Dashboard 2',
      errorMessage: 'Network error',
    },
  ];

  const result =
    resultOverrides !== undefined
      ? resultOverrides.map((override) => ({ status: 'failed' as const, title: 'Default Title', ...override }))
      : defaultFailedItems;

  const onDismiss = onDismissOverride || jest.fn();

  const props = {
    result,
    onDismiss,
  };

  return {
    user: userEvent.setup(),
    ...render(<BulkActionFailureBanner {...props} />),
    props,
  };
};

describe('BulkActionFailureBanner', () => {
  it('should display correct count in title for single item', () => {
    setup([{ title: 'Single Item', errorMessage: 'Single error' }]);

    expect(screen.getByText('1 items failed')).toBeInTheDocument();
  });

  it('should render list of failed items with titles and error messages', () => {
    setup([
      { title: 'Failed Dashboard A', errorMessage: 'Access denied' },
      { title: 'Failed Dashboard B', errorMessage: 'Validation failed' },
    ]);

    expect(screen.getByText('2 items failed')).toBeInTheDocument();

    expect(screen.getByText('Failed Dashboard A')).toBeInTheDocument();
    expect(screen.getByText(': Access denied')).toBeInTheDocument();
    expect(screen.getByText('Failed Dashboard B')).toBeInTheDocument();
    expect(screen.getByText(': Validation failed')).toBeInTheDocument();
  });

  it('should handle mixed scenarios with some items having errors and others not', () => {
    setup([
      { title: 'Item without error' },
      { title: 'Item with empty error', errorMessage: '' },
      { title: 'Another item with error', errorMessage: 'Another error' },
    ]);

    expect(screen.getByText('3 items failed')).toBeInTheDocument();
    expect(screen.getByText('Item without error')).toBeInTheDocument();
    expect(screen.getByText('Item with empty error')).toBeInTheDocument();
    expect(screen.getByText('Another item with error')).toBeInTheDocument();
    expect(screen.getByText(': Another error')).toBeInTheDocument();
  });

  it('should render items as list elements', () => {
    setup([
      { title: 'Item 1', errorMessage: 'Error 1' },
      { title: 'Item 2', errorMessage: 'Error 2' },
    ]);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
  });

  it('should handle items with only title', () => {
    setup([{ title: 'Just Title Item' }]);

    expect(screen.getByText('Just Title Item')).toBeInTheDocument();
    expect(screen.queryByText(': ')).not.toBeInTheDocument();
  });
});
