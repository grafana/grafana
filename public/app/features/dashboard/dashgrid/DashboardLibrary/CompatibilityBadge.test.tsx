import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { CompatibilityBadge, CompatibilityState } from './CompatibilityBadge';

describe('CompatibilityBadge', () => {
  const mockOnCheck = jest.fn();
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('idle state', () => {
    it('should render "Check" button when status is idle', () => {
      const state: CompatibilityState = { status: 'idle' };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      expect(screen.getByRole('button', { name: 'Check compatibility' })).toBeInTheDocument();
    });

    it('should call onCheck when "Check" button is clicked', async () => {
      const state: CompatibilityState = { status: 'idle' };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      await userEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));

      expect(mockOnCheck).toHaveBeenCalledTimes(1);
    });

    it('should stop event propagation when "Check" button is clicked', async () => {
      const state: CompatibilityState = { status: 'idle' };
      const mockParentClick = jest.fn();

      render(
        <div onClick={mockParentClick}>
          <CompatibilityBadge state={state} onCheck={mockOnCheck} />
        </div>
      );

      await userEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));

      expect(mockOnCheck).toHaveBeenCalledTimes(1);
      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should render disabled button with "Checking" text and spinner when status is loading', () => {
      const state: CompatibilityState = { status: 'loading' };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      const button = screen.getByRole('button', { name: 'Checking' });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Checking');
      expect(screen.getByTestId('compatibility-badge-loading')).toBeInTheDocument();
    });

    it('should not call onCheck when disabled button is clicked', async () => {
      const state: CompatibilityState = { status: 'loading' };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      const button = screen.getByRole('button', { name: 'Checking' });
      await userEvent.click(button);

      expect(mockOnCheck).not.toHaveBeenCalled();
    });
  });

  describe('success state', () => {
    it('should render badge with score when score >= 80%', () => {
      const state: CompatibilityState = {
        status: 'success',
        score: 85,
        metricsFound: 17,
        metricsTotal: 20,
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      const badge = screen.getByTestId('compatibility-badge-success');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('85%');
    });

    it('should render badge with score when score is 50-79%', () => {
      const state: CompatibilityState = {
        status: 'success',
        score: 65,
        metricsFound: 13,
        metricsTotal: 20,
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      const badge = screen.getByTestId('compatibility-badge-success');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('65%');
    });

    it('should render badge with score when score < 50%', () => {
      const state: CompatibilityState = {
        status: 'success',
        score: 30,
        metricsFound: 6,
        metricsTotal: 20,
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      const badge = screen.getByTestId('compatibility-badge-success');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('30%');
    });

    it('should handle edge case score of exactly 80%', () => {
      const state: CompatibilityState = {
        status: 'success',
        score: 80,
        metricsFound: 16,
        metricsTotal: 20,
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      // Score of 80 should be green (>= 80)
      const badge = screen.getByTestId('compatibility-badge-success');
      expect(badge).toHaveTextContent('80%');
    });

    it('should handle edge case score of exactly 50%', () => {
      const state: CompatibilityState = {
        status: 'success',
        score: 50,
        metricsFound: 10,
        metricsTotal: 20,
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      // Score of 50 should be orange (>= 50)
      const badge = screen.getByTestId('compatibility-badge-success');
      expect(badge).toHaveTextContent('50%');
    });

    it('should handle 0% score', () => {
      const state: CompatibilityState = {
        status: 'success',
        score: 0,
        metricsFound: 0,
        metricsTotal: 20,
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      const badge = screen.getByTestId('compatibility-badge-success');
      expect(badge).toHaveTextContent('0%');
    });

    it('should handle 100% score', () => {
      const state: CompatibilityState = {
        status: 'success',
        score: 100,
        metricsFound: 20,
        metricsTotal: 20,
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} />);

      const badge = screen.getByTestId('compatibility-badge-success');
      expect(badge).toHaveTextContent('100%');
    });
  });

  describe('error state', () => {
    it('should render error badge when status is error', () => {
      const state: CompatibilityState = {
        status: 'error',
        errorMessage: 'API request failed',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      expect(screen.getByTestId('compatibility-badge-error')).toBeInTheDocument();
    });

    it('should call onRetry when error badge is clicked', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorMessage: 'API request failed',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      await userEvent.click(screen.getByTestId('compatibility-badge-error'));

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should render error badge when errorMessage is not provided', () => {
      const state: CompatibilityState = {
        status: 'error',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      expect(screen.getByTestId('compatibility-badge-error')).toBeInTheDocument();
    });

    it('should stop event propagation when error badge is clicked', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorMessage: 'Error',
      };
      const mockParentClick = jest.fn();

      render(
        <div onClick={mockParentClick}>
          <CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />
        </div>
      );

      await userEvent.click(screen.getByTestId('compatibility-badge-error'));

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
      expect(mockParentClick).not.toHaveBeenCalled();
    });

    it('should show not-supported tooltip for datasource_wrong_type', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorCode: 'datasource_wrong_type',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      await userEvent.hover(screen.getByTestId('compatibility-badge-error'));

      expect(await screen.findByText(/not yet supported/i)).toBeInTheDocument();
    });

    it('should show not-supported tooltip for unsupported_dashboard_version', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorCode: 'unsupported_dashboard_version',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      await userEvent.hover(screen.getByTestId('compatibility-badge-error'));

      expect(await screen.findByText(/not yet supported/i)).toBeInTheDocument();
    });

    it('should show not-supported tooltip for invalid_dashboard', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorCode: 'invalid_dashboard',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      await userEvent.hover(screen.getByTestId('compatibility-badge-error'));

      expect(await screen.findByText(/not yet supported/i)).toBeInTheDocument();
    });

    it('should show troubleshooting tooltip for unexpected errors', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorCode: 'datasource_auth_failed',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      await userEvent.hover(screen.getByTestId('compatibility-badge-error'));

      expect(await screen.findByText(/Compatibility check failed/i)).toBeInTheDocument();
    });

    it('should show troubleshooting tooltip when errorCode is not provided', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorMessage: 'Unknown error',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      await userEvent.hover(screen.getByTestId('compatibility-badge-error'));

      expect(await screen.findByText(/Compatibility check failed/i)).toBeInTheDocument();
    });

    it('should allow retry on not_supported errors', async () => {
      const state: CompatibilityState = {
        status: 'error',
        errorCode: 'datasource_wrong_type',
      };
      render(<CompatibilityBadge state={state} onCheck={mockOnCheck} onRetry={mockOnRetry} />);

      await userEvent.click(screen.getByTestId('compatibility-badge-error'));

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });
});
