import { render, screen, act } from '@testing-library/react';
import { ReactNode } from 'react';

import { StepStatusProvider, useStepStatus } from './StepStatusContext';
import { StepStatusInfo } from './types';

function MockComponent() {
  const { stepStatusInfo, setStepStatusInfo, hasStepError, isStepRunning, isStepSuccess, isStepIdle } = useStepStatus();

  return (
    <div>
      <div data-testid="status">{stepStatusInfo.status}</div>
      <div data-testid="error">{'error' in stepStatusInfo ? stepStatusInfo.error : ''}</div>
      <div data-testid="hasStepError">{hasStepError.toString()}</div>
      <div data-testid="isStepRunning">{isStepRunning.toString()}</div>
      <div data-testid="isStepSuccess">{isStepSuccess.toString()}</div>
      <div data-testid="isStepIdle">{isStepIdle.toString()}</div>
      <button data-testid="set-running" onClick={() => setStepStatusInfo({ status: 'running' })}>
        Set Running
      </button>
      <button data-testid="set-success" onClick={() => setStepStatusInfo({ status: 'success' })}>
        Set Success
      </button>
      <button data-testid="set-error" onClick={() => setStepStatusInfo({ status: 'error', error: 'Test error' })}>
        Set Error
      </button>
      <button data-testid="set-idle" onClick={() => setStepStatusInfo({ status: 'idle' })}>
        Set Idle
      </button>
    </div>
  );
}

function TestWrapper({
  children,
  onStepStatusChange,
}: {
  children: ReactNode;
  onStepStatusChange?: (status: StepStatusInfo) => void;
}) {
  return <StepStatusProvider onStepStatusChange={onStepStatusChange}>{children}</StepStatusProvider>;
}

describe('StepStatusContext', () => {
  describe('StepStatusProvider', () => {
    it('should provide initial idle status', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('status')).toHaveTextContent('idle'); // Initial status should be idle
      expect(screen.getByTestId('error')).toHaveTextContent(''); // Initially no error
      expect(screen.getByTestId('isStepIdle')).toHaveTextContent('true'); // Initially idle

      // Check other statuses
      expect(screen.getByTestId('hasStepError')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepRunning')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepSuccess')).toHaveTextContent('false');
    });

    it('should update status to running', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('set-running').click();
      });

      expect(screen.getByTestId('status')).toHaveTextContent('running');
      expect(screen.getByTestId('isStepRunning')).toHaveTextContent('true');

      // Check other statuses
      expect(screen.getByTestId('hasStepError')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepSuccess')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepIdle')).toHaveTextContent('false');
    });

    it('should update status to success', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('set-success').click();
      });

      expect(screen.getByTestId('status')).toHaveTextContent('success');
      expect(screen.getByTestId('isStepSuccess')).toHaveTextContent('true');

      // Check other statuses
      expect(screen.getByTestId('hasStepError')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepRunning')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepIdle')).toHaveTextContent('false');
    });

    it('should update status to error with error message', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('set-error').click();
      });

      expect(screen.getByTestId('status')).toHaveTextContent('error');
      expect(screen.getByTestId('error')).toHaveTextContent('Test error'); // Check error message
      expect(screen.getByTestId('hasStepError')).toHaveTextContent('true');

      // Check other statuses
      expect(screen.getByTestId('isStepRunning')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepSuccess')).toHaveTextContent('false');
      expect(screen.getByTestId('isStepIdle')).toHaveTextContent('false');
    });

    it('should call onStepStatusChange callback when status changes', () => {
      const mockCallback = jest.fn();

      render(
        <TestWrapper onStepStatusChange={mockCallback}>
          <MockComponent />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('set-running').click();
      });

      expect(mockCallback).toHaveBeenCalledWith({ status: 'running' });

      act(() => {
        screen.getByTestId('set-error').click();
      });

      expect(mockCallback).toHaveBeenCalledWith({ status: 'error', error: 'Test error' });
    });
  });

  describe('useStepStatus', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<MockComponent />);
      }).toThrow('useStepStatus must be used within a StepStatusProvider');

      consoleSpy.mockRestore();
    });

    it('should provide all required context values', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      // Check that all expected elements are present
      expect(screen.getByTestId('status')).toBeInTheDocument();
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.getByTestId('hasStepError')).toBeInTheDocument();
      expect(screen.getByTestId('isStepRunning')).toBeInTheDocument();
      expect(screen.getByTestId('isStepSuccess')).toBeInTheDocument();
      expect(screen.getByTestId('isStepIdle')).toBeInTheDocument();
    });
  });

  describe('computed status checks', () => {
    it('should correctly compute hasStepError', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      // Initially false
      expect(screen.getByTestId('hasStepError')).toHaveTextContent('false');

      // True when error
      act(() => {
        screen.getByTestId('set-error').click();
      });
      expect(screen.getByTestId('hasStepError')).toHaveTextContent('true');

      // False when not error
      act(() => {
        screen.getByTestId('set-success').click();
      });
      expect(screen.getByTestId('hasStepError')).toHaveTextContent('false');
    });

    it('should correctly compute isStepRunning', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      // Initially false
      expect(screen.getByTestId('isStepRunning')).toHaveTextContent('false');

      // True when running
      act(() => {
        screen.getByTestId('set-running').click();
      });
      expect(screen.getByTestId('isStepRunning')).toHaveTextContent('true');

      // False when not running
      act(() => {
        screen.getByTestId('set-idle').click();
      });
      expect(screen.getByTestId('isStepRunning')).toHaveTextContent('false');
    });

    it('should correctly compute isStepSuccess', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      // Initially false
      expect(screen.getByTestId('isStepSuccess')).toHaveTextContent('false');

      // True when success
      act(() => {
        screen.getByTestId('set-success').click();
      });
      expect(screen.getByTestId('isStepSuccess')).toHaveTextContent('true');

      // False when not success
      act(() => {
        screen.getByTestId('set-error').click();
      });
      expect(screen.getByTestId('isStepSuccess')).toHaveTextContent('false');
    });

    it('should correctly compute isStepIdle', () => {
      render(
        <TestWrapper>
          <MockComponent />
        </TestWrapper>
      );

      // Initially true
      expect(screen.getByTestId('isStepIdle')).toHaveTextContent('true');

      // False when not idle
      act(() => {
        screen.getByTestId('set-running').click();
      });
      expect(screen.getByTestId('isStepIdle')).toHaveTextContent('false');

      // True when idle again
      act(() => {
        screen.getByTestId('set-idle').click();
      });
      expect(screen.getByTestId('isStepIdle')).toHaveTextContent('true');
    });
  });

  describe('callback behavior', () => {
    it('should call callback multiple times for multiple status changes', () => {
      const mockCallback = jest.fn();

      render(
        <TestWrapper onStepStatusChange={mockCallback}>
          <MockComponent />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('set-running').click();
      });

      act(() => {
        screen.getByTestId('set-success').click();
      });

      act(() => {
        screen.getByTestId('set-error').click();
      });

      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenNthCalledWith(1, { status: 'running' });
      expect(mockCallback).toHaveBeenNthCalledWith(2, { status: 'success' });
      expect(mockCallback).toHaveBeenNthCalledWith(3, { status: 'error', error: 'Test error' });
    });
  });
});
