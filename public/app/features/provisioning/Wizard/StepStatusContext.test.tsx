import { renderHook, act } from '@testing-library/react';
import { PropsWithChildren } from 'react';

import { StepStatusProvider, useStepStatus } from './StepStatusContext';

describe('StepStatusContext', () => {
  const wrapper = ({ children }: PropsWithChildren<{}>) => <StepStatusProvider>{children}</StepStatusProvider>;

  describe('useStepStatus hook', () => {
    // Initial state (Status: Idle)
    it('should provide initial idle status', () => {
      const { result } = renderHook(() => useStepStatus(), { wrapper });

      expect(result.current.stepStatusInfo.status).toBe('idle');
      expect(result.current.isStepIdle).toBe(true);
      expect(result.current.hasStepError).toBe(false);
      expect(result.current.isStepRunning).toBe(false);
      expect(result.current.isStepSuccess).toBe(false);
    });

    // Status: Running
    it('should update status to running', () => {
      const { result } = renderHook(() => useStepStatus(), { wrapper });

      act(() => {
        result.current.setStepStatusInfo({ status: 'running' });
      });

      expect(result.current.stepStatusInfo.status).toBe('running');
      expect(result.current.isStepRunning).toBe(true);
      expect(result.current.isStepIdle).toBe(false);
    });

    // Status: Success
    it('should update status to success', () => {
      const { result } = renderHook(() => useStepStatus(), { wrapper });

      act(() => {
        result.current.setStepStatusInfo({ status: 'success' });
      });

      expect(result.current.stepStatusInfo.status).toBe('success');
      expect(result.current.isStepSuccess).toBe(true);
      expect(result.current.isStepIdle).toBe(false);
      expect(result.current.hasStepError).toBe(false);
      expect(result.current.isStepRunning).toBe(false);
    });

    // Status: Error
    it('should update status to error with message', () => {
      const { result } = renderHook(() => useStepStatus(), { wrapper });

      act(() => {
        result.current.setStepStatusInfo({ status: 'error', error: 'Test error' });
      });

      const { stepStatusInfo } = result.current;

      expect(stepStatusInfo.status).toBe('error');
      expect(result.current.hasStepError).toBe(true);

      // Check if error property exists
      if ('error' in stepStatusInfo) {
        expect(stepStatusInfo.error).toBe('Test error');
      }
    });

    // Status transitions tests
    it('should handle status transitions correctly', () => {
      const { result } = renderHook(() => useStepStatus(), { wrapper });

      // idle -> running
      act(() => {
        result.current.setStepStatusInfo({ status: 'running' });
      });
      expect(result.current.isStepRunning).toBe(true);

      // running -> success
      act(() => {
        result.current.setStepStatusInfo({ status: 'success' });
      });
      expect(result.current.isStepSuccess).toBe(true);
      expect(result.current.isStepRunning).toBe(false);

      // success -> idle (reset)
      act(() => {
        result.current.setStepStatusInfo({ status: 'idle' });
      });
      expect(result.current.isStepIdle).toBe(true);
      expect(result.current.isStepSuccess).toBe(false);
    });

    it('should handle multiple status updates', () => {
      const { result } = renderHook(() => useStepStatus(), { wrapper });

      act(() => {
        result.current.setStepStatusInfo({ status: 'running' });
        result.current.setStepStatusInfo({ status: 'error', error: 'Failed' });
        result.current.setStepStatusInfo({ status: 'success' });
      });

      // Should end up in success state
      expect(result.current.stepStatusInfo.status).toBe('success');
      expect(result.current.isStepSuccess).toBe(true);
    });

    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useStepStatus());
      }).toThrow('useStepStatus must be used within a StepStatusProvider');

      consoleSpy.mockRestore();
    });
  });
});
