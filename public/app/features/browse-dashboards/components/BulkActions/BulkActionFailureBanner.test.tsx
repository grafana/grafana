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
  it('should display error alert with correct item count', () => {
    const testData = [{ title: 'Single Item', errorMessage: 'Single error' }];
    setup(testData);

    // Test that an alert is rendered
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();

    // Test structure: should have same number of list items as input data
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(testData.length);
  });

  it('should render correct number of failed items with proper structure', () => {
    const testData = [
      { title: 'Failed Dashboard A', errorMessage: 'Access denied' },
      { title: 'Failed Dashboard B', errorMessage: 'Validation failed' },
    ];
    setup(testData);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();

    // Test structure: number of list items matches input
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(testData.length);

    // Test that each item has the expected structure (title + error message)
    listItems.forEach((item, index) => {
      const title = testData[index].title;
      const errorMessage = testData[index].errorMessage;

      if (title) {
        expect(item).toHaveTextContent(title);
      }
      if (errorMessage) {
        expect(item).toHaveTextContent(errorMessage);
      }
    });
  });

  it('should handle mixed scenarios', () => {
    const testData = [
      { title: 'Item without error' },
      { title: 'Item with empty error', errorMessage: '' },
      { title: 'Another item with error', errorMessage: 'Another error' },
    ];
    setup(testData);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(testData.length);

    // Test that items with error messages contain both title and error
    // Items without errors should only contain title
    testData.forEach((data, index) => {
      const listItem = listItems[index];

      // All items should have their title
      if (data.title) {
        expect(listItem).toHaveTextContent(data.title);
      }

      // Only items with non-empty error messages should show the error
      if (data.errorMessage && data.errorMessage.trim() !== '') {
        expect(listItem).toHaveTextContent(data.errorMessage);
      }
    });
  });

  it('should maintain list structure', () => {
    const testData = [
      { title: 'Item 1', errorMessage: 'Error 1' },
      { title: 'Item 2', errorMessage: 'Error 2' },
    ];
    setup(testData);

    // Test semantic structure
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(testData.length);
  });

  it('should handle items without error messages', () => {
    const testData = [{ title: 'Just Title Item' }];
    setup(testData);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(1);

    const item = listItems[0];
    expect(item).toHaveTextContent(testData[0].title!);
    // Should not contain colon separator when no error message
    expect(item.textContent).not.toMatch(/:\s*.+$/);
  });

  it('should render dismissible alert', () => {
    const onDismiss = jest.fn();
    setup([], onDismiss);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();

    // Alert should have close button (dismissible)
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });
});
