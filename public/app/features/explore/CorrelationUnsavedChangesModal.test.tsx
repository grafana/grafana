import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { render } from '../../../test/test-utils';

import { CorrelationUnsavedChangesModal } from './CorrelationUnsavedChangesModal';

describe('CorrelationUnsavedChangesModal', () => {
  const defaultProps = {
    message: 'You have unsaved changes.',
    onDiscard: jest.fn(),
    onCancel: jest.fn(),
    onSave: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal title', () => {
    render(<CorrelationUnsavedChangesModal {...defaultProps} />);
    expect(screen.getByText('Unsaved changes to correlation')).toBeInTheDocument();
  });

  it('should render the provided message', () => {
    render(<CorrelationUnsavedChangesModal {...defaultProps} />);
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
  });

  it('should render all action buttons', () => {
    render(<CorrelationUnsavedChangesModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue without saving/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save correlation/i })).toBeInTheDocument();
  });

  it('should call onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CorrelationUnsavedChangesModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onDiscard when Continue without saving is clicked', async () => {
    const user = userEvent.setup();
    render(<CorrelationUnsavedChangesModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /continue without saving/i }));
    expect(defaultProps.onDiscard).toHaveBeenCalledTimes(1);
  });

  it('should call onSave when Save correlation is clicked', async () => {
    const user = userEvent.setup();
    render(<CorrelationUnsavedChangesModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /save correlation/i }));
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });
});
