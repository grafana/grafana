import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { ConfirmModal } from './ConfirmModal';

jest.useFakeTimers();

describe('ConfirmModal', () => {
  const mockOnConfirm = jest.fn();

  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render correct title, body, dismiss-, alternative- and confirm-text', () => {
    render(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Please Confirm"
        alternativeText="Alternative Text"
        dismissText="Dismiss Text"
        isOpen={true}
        onConfirm={() => {}}
        onDismiss={() => {}}
        onAlternative={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Some Title' })).toBeInTheDocument();
    expect(screen.getByText('Some Body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alternative Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeInTheDocument();
  });

  it('should render nothing when isOpen is false', () => {
    render(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Confirm"
        isOpen={false}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.queryByRole('heading', { name: 'Some Title' })).not.toBeInTheDocument();
    expect(screen.queryByText('Some Body')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss Text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alternative Text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  });

  it('disables the confirm button initially when confirmation text is present', () => {
    render(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Please Confirm"
        alternativeText="Alternative Text"
        dismissText="Dismiss Text"
        isOpen={true}
        confirmationText="My confirmation text"
        onConfirm={() => {}}
        onDismiss={() => {}}
        onAlternative={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeDisabled();
  });

  it('typing the confirmation text should enable the confirm button regardless of case', async () => {
    render(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Please Confirm"
        alternativeText="Alternative Text"
        dismissText="Dismiss Text"
        isOpen={true}
        confirmationText="My confirmation text"
        onConfirm={mockOnConfirm}
        onDismiss={() => {}}
        onAlternative={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Type "My confirmation text" to confirm'), 'mY CoNfIrMaTiOn TeXt');
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Please Confirm' }));
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('typing the confirmation text and pressing enter should trigger the primary action', async () => {
    render(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Please Confirm"
        alternativeText="Alternative Text"
        dismissText="Dismiss Text"
        isOpen={true}
        confirmationText="My confirmation text"
        onConfirm={mockOnConfirm}
        onDismiss={() => {}}
        onAlternative={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Type "My confirmation text" to confirm'), 'mY CoNfIrMaTiOn TeXt');
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeEnabled();

    await user.type(screen.getByPlaceholderText('Type "My confirmation text" to confirm'), '{enter}');
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('returning a promise in the onConfirm callback disables the button whilst the callback is in progress', async () => {
    mockOnConfirm.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve('');
        }, 1000);
      });
    });
    render(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Please Confirm"
        alternativeText="Alternative Text"
        dismissText="Dismiss Text"
        isOpen={true}
        confirmationText="My confirmation text"
        onConfirm={mockOnConfirm}
        onDismiss={() => {}}
        onAlternative={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Type "My confirmation text" to confirm'), 'My confirmation text');
    expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Please Confirm' }));
    expect(mockOnConfirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeDisabled();
    });

    jest.runAllTimers();
    await waitFor(() => {
      return expect(screen.getByRole('button', { name: 'Please Confirm' })).toBeEnabled();
    });
  });

  it('should disable the confirm button when disabled prop changes from false to true', async () => {
    const TestComponent = () => {
      const [disabled, setDisabled] = useState(false);

      const handleConfirm = async () => {
        act(() => {
          setDisabled(true);
          setTimeout(() => {
            setDisabled(false);
          }, 4000);
        });
      };

      return (
        <ConfirmModal
          title="Some Title"
          body="Some Body"
          confirmText="Please Confirm"
          isOpen={true}
          onConfirm={handleConfirm}
          onDismiss={() => {}}
          onAlternative={() => {}}
          disabled={disabled}
        />
      );
    };

    render(<TestComponent />);

    const confirmButton = screen.getByRole('button', { name: 'Please Confirm' });

    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    // Ensure React processes the state update and calls useEffect in ConfirmModal
    await act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(confirmButton).toBeDisabled();

    // Fast-forward time by 4 seconds
    await act(() => {
      jest.advanceTimersByTime(4000);
    });

    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
  });
});
