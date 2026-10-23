import { render, screen } from 'test/test-utils';

import { DeleteNotebookModal } from './DeleteNotebookModal';

describe('DeleteNotebookModal', () => {
  // t() HTML-escapes interpolated values by default, which would show as `Checkout&#39;s`.
  it('leaves punctuation in the title alone', () => {
    render(
      <DeleteNotebookModal
        title="Checkout's errors/sec"
        isDeleting={false}
        onConfirm={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByText(`Are you sure you want to delete "Checkout's errors/sec"?`)).toBeInTheDocument();
  });
});
