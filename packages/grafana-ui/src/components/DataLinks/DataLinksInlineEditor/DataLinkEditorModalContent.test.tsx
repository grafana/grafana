import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';

const defaultProps = {
  link: { title: '', url: '' },
  index: 0,
  data: [],
  getSuggestions: () => [],
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

describe('DataLinkEditorModalContent', () => {
  it('renders buttons and disables save when title and url are empty', async () => {
    render(<DataLinkEditorModalContent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save').closest('button')).toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = jest.fn();
    render(<DataLinkEditorModalContent {...defaultProps} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledWith(0);
  });
});
