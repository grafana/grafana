import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { render, screen } from 'test/test-utils';

import { StepperStateProvider, useStepperState } from './StepperState';
import { StepKey, StepState } from './types';

const wrapper = ({ children, initialStep }: { children: ReactNode; initialStep?: StepKey }) => (
  <StepperStateProvider initialStep={initialStep}>{children}</StepperStateProvider>
);

describe('StepperStateProvider', () => {
  it('should provide context to children', () => {
    const TestComponent = () => {
      const { activeStep } = useStepperState();
      return <div data-testid="test">{activeStep}</div>;
    };

    render(
      <StepperStateProvider initialStep={StepKey.Notifications}>
        <TestComponent />
      </StepperStateProvider>
    );

    expect(screen.getByTestId('test')).toHaveTextContent(StepKey.Notifications);
  });

  it('should default to Notifications step when no initialStep is provided', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    expect(result.current.activeStep).toBe(StepKey.Notifications);
  });

  it('should use provided initialStep', () => {
    const { result } = renderHook(() => useStepperState(), {
      wrapper: ({ children }) => wrapper({ children, initialStep: StepKey.Rules }),
    });

    expect(result.current.activeStep).toBe(StepKey.Rules);
  });
});

describe('useStepperState', () => {
  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useStepperState());
    }).toThrow('You can only use `useStepperState` in a component wrapped in a `StepperStateProvider`.');

    consoleSpy.mockRestore();
  });

  it('should update active step when setActiveStep is called', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    expect(result.current.activeStep).toBe(StepKey.Notifications);

    act(() => {
      result.current.setActiveStep(StepKey.Rules);
    });

    expect(result.current.activeStep).toBe(StepKey.Rules);
  });

  it('should track visited steps', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    expect(result.current.visitedSteps[StepKey.Notifications]).toBe(StepState.Idle);

    act(() => {
      result.current.setVisitedStep(StepKey.Notifications);
    });

    expect(result.current.visitedSteps[StepKey.Notifications]).toBe(StepState.Visited);
  });

  it('should track completed steps', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    expect(result.current.isStepCompleted(StepKey.Notifications)).toBe(false);

    act(() => {
      result.current.setStepCompleted(StepKey.Notifications, true);
    });

    expect(result.current.isStepCompleted(StepKey.Notifications)).toBe(true);

    act(() => {
      result.current.setStepCompleted(StepKey.Notifications, false);
    });

    expect(result.current.isStepCompleted(StepKey.Notifications)).toBe(false);
  });

  it('should track skipped steps', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    expect(result.current.isStepSkipped(StepKey.Notifications)).toBe(false);

    act(() => {
      result.current.setStepSkipped(StepKey.Notifications, true);
    });

    expect(result.current.isStepSkipped(StepKey.Notifications)).toBe(true);

    act(() => {
      result.current.setStepSkipped(StepKey.Notifications, false);
    });

    expect(result.current.isStepSkipped(StepKey.Notifications)).toBe(false);
  });

  it('should track step errors', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    expect(result.current.hasStepErrors(StepKey.Notifications)).toBe(false);

    act(() => {
      result.current.setStepErrors(StepKey.Notifications, true);
    });

    expect(result.current.hasStepErrors(StepKey.Notifications)).toBe(true);

    act(() => {
      result.current.setStepErrors(StepKey.Notifications, false);
    });

    expect(result.current.hasStepErrors(StepKey.Notifications)).toBe(false);
  });

  it('should handle multiple steps independently', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    // Set different states for different steps
    act(() => {
      result.current.setStepCompleted(StepKey.Notifications, true);
      result.current.setStepSkipped(StepKey.Rules, true);
      result.current.setStepErrors(StepKey.Review, true);
    });

    expect(result.current.isStepCompleted(StepKey.Notifications)).toBe(true);
    expect(result.current.isStepSkipped(StepKey.Rules)).toBe(true);
    expect(result.current.hasStepErrors(StepKey.Review)).toBe(true);

    // Other steps should remain in their default state
    expect(result.current.isStepCompleted(StepKey.Rules)).toBe(false);
    expect(result.current.isStepSkipped(StepKey.Notifications)).toBe(false);
    expect(result.current.hasStepErrors(StepKey.Notifications)).toBe(false);
  });

  it('should initialize visitedSteps with Idle state for all steps', () => {
    const { result } = renderHook(() => useStepperState(), { wrapper });

    expect(result.current.visitedSteps[StepKey.Notifications]).toBe(StepState.Idle);
    expect(result.current.visitedSteps[StepKey.Rules]).toBe(StepState.Idle);
    expect(result.current.visitedSteps[StepKey.Review]).toBe(StepState.Idle);
  });
});
