import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BulkActionFailureBanner, MoveResultFailed } from './BulkActionFailureBanner';

describe('BulkActionFailureBanner', () => {
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders alert with correct severity and title for single failed item', () => {
    const result: MoveResultFailed[] = [
      {
        status: 'failed',
        title: 'Dashboard 1',
        errorMessage: 'Permission denied',
      },
    ];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('1 items failed')).toBeInTheDocument();
  });

  it('renders alert with correct title for multiple failed items', () => {
    const result: MoveResultFailed[] = [
      {
        status: 'failed',
        title: 'Dashboard 1',
        errorMessage: 'Permission denied',
      },
      {
        status: 'failed',
        title: 'Dashboard 2',
        errorMessage: 'Not found',
      },
    ];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('2 items failed')).toBeInTheDocument();
  });

  it('displays list of failed items with titles and error messages', () => {
    const result: MoveResultFailed[] = [
      {
        status: 'failed',
        title: 'Dashboard 1',
        errorMessage: 'Permission denied',
      },
      {
        status: 'failed',
        title: 'Dashboard 2',
        errorMessage: 'Not found',
      },
    ];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText(': Permission denied')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
    expect(screen.getByText(': Not found')).toBeInTheDocument();
  });

  it('displays item title without error message when errorMessage is missing', () => {
    const result: MoveResultFailed[] = [
      {
        status: 'failed',
        title: 'Dashboard 1',
      },
    ];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.queryByText(':')).not.toBeInTheDocument();
  });

  it('displays item title without error message when errorMessage is empty string', () => {
    const result: MoveResultFailed[] = [
      {
        status: 'failed',
        title: 'Dashboard 1',
        errorMessage: '',
      },
    ];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.queryByText(':')).not.toBeInTheDocument();
  });

  it('calls onDismiss when alert is dismissed', async () => {
    const user = userEvent.setup();
    const result: MoveResultFailed[] = [
      {
        status: 'failed',
        title: 'Dashboard 1',
        errorMessage: 'Permission denied',
      },
    ];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    const closeButton = screen.getByRole('button', { name: /close alert/i });
    await user.click(closeButton);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('handles empty result array', () => {
    const result: MoveResultFailed[] = [];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('0 items failed')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('handles items with missing title', () => {
    const result: MoveResultFailed[] = [
      {
        status: 'failed',
        errorMessage: 'Permission denied',
      },
    ];

    render(<BulkActionFailureBanner result={result} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('1 items failed')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });
});
