import { renderHook } from '@testing-library/react';

import { Step } from '../Stepper';
import { WizardStep } from '../types';

import { useWizardButtons, UseWizardButtonsParams } from './useWizardButtons';

jest.mock('@grafana/i18n', () => ({
  t: jest.fn((key: string, defaultValue: string) => defaultValue),
}));

describe('useWizardButtons', () => {
  const mockSteps: Array<Step<WizardStep>> = [
    { id: 'connection', name: 'Connection', title: 'Set up connection' },
    { id: 'bootstrap', name: 'Bootstrap', title: 'Bootstrap repository' },
    { id: 'synchronize', name: 'Synchronize', title: 'Synchronize' },
    { id: 'finish', name: 'Finish', title: 'Finish setup' },
  ];

  const defaultParams: UseWizardButtonsParams = {
    activeStep: 'connection',
    steps: mockSteps,
    repoName: '',
    canSkipSync: false,
    isSubmitting: false,
    isCancelling: false,
    isStepRunning: false,
    isStepSuccess: false,
    hasStepError: false,
    hasStepWarning: false,
    isCreatingSkipJob: false,
    showCancelConfirmation: false,
    shouldUseCancelBehavior: false,
  };

  function setup(overrides: Partial<UseWizardButtonsParams> = {}) {
    const params = { ...defaultParams, ...overrides };
    return renderHook(() => useWizardButtons(params));
  }

  describe('nextButtonText', () => {
    it('should show next step name when not on last step', () => {
      const { result } = setup({ activeStep: 'connection' });
      expect(result.current.nextButtonText).toBe('Bootstrap');
    });

    it('should show "Finish" when on last step', () => {
      const { result } = setup({ activeStep: 'finish' });
      expect(result.current.nextButtonText).toBe('Finish');
    });

    it('should show "Finish" when step not found in steps array', () => {
      const { result } = setup({ activeStep: 'authType' });
      expect(result.current.nextButtonText).toBe('Finish');
    });

    it('should skip sync step when canSkipSync is true on bootstrap step', () => {
      const { result } = setup({
        activeStep: 'bootstrap',
        canSkipSync: true,
      });
      expect(result.current.nextButtonText).toBe('Finish');
    });

    it('should show synchronize step when canSkipSync is false on bootstrap step', () => {
      const { result } = setup({
        activeStep: 'bootstrap',
        canSkipSync: false,
      });
      expect(result.current.nextButtonText).toBe('Synchronize');
    });
  });

  describe('previousButtonText', () => {
    it('should show "Previous" when no cancel behavior', () => {
      const { result } = setup({
        activeStep: 'bootstrap',
        shouldUseCancelBehavior: false,
        repoName: '',
      });
      expect(result.current.previousButtonText).toBe('Previous');
    });

    it('should show "Cancel" when shouldUseCancelBehavior is true', () => {
      const { result } = setup({
        shouldUseCancelBehavior: true,
      });
      expect(result.current.previousButtonText).toBe('Cancel');
    });

    it('should show "Cancel" on connection step when repoName exists', () => {
      const { result } = setup({
        activeStep: 'connection',
        repoName: 'test-repo',
        shouldUseCancelBehavior: false,
      });
      expect(result.current.previousButtonText).toBe('Cancel');
    });

    it('should show "Cancelling..." when isCancelling is true', () => {
      const { result } = setup({
        isCancelling: true,
      });
      expect(result.current.previousButtonText).toBe('Cancelling...');
    });
  });

  describe('isNextDisabled', () => {
    it('should always enable next on authType step', () => {
      const { result } = setup({
        activeStep: 'authType',
        isSubmitting: true,
        hasStepError: true,
      });
      expect(result.current.isNextDisabled).toBe(false);
    });

    it('should disable next when hasStepError on non-connection steps', () => {
      const { result } = setup({
        activeStep: 'bootstrap',
        hasStepError: true,
      });
      expect(result.current.isNextDisabled).toBe(true);
    });

    it('should not disable next when hasStepError on connection step', () => {
      const { result } = setup({
        activeStep: 'connection',
        hasStepError: true,
      });
      expect(result.current.isNextDisabled).toBe(false);
    });

    it('should disable next on synchronize step unless success or warning', () => {
      const { result } = setup({
        activeStep: 'synchronize',
        isStepSuccess: false,
        hasStepWarning: false,
      });
      expect(result.current.isNextDisabled).toBe(true);
    });

    it('should enable next on synchronize step when step is successful', () => {
      const { result } = setup({
        activeStep: 'synchronize',
        isStepSuccess: true,
      });
      expect(result.current.isNextDisabled).toBe(false);
    });

    it('should enable next on synchronize step when has warning', () => {
      const { result } = setup({
        activeStep: 'synchronize',
        hasStepWarning: true,
      });
      expect(result.current.isNextDisabled).toBe(false);
    });

    it('should disable next when isSubmitting', () => {
      const { result } = setup({ isSubmitting: true });
      expect(result.current.isNextDisabled).toBe(true);
    });

    it('should disable next when isCancelling', () => {
      const { result } = setup({ isCancelling: true });
      expect(result.current.isNextDisabled).toBe(true);
    });

    it('should disable next when isStepRunning', () => {
      const { result } = setup({ isStepRunning: true });
      expect(result.current.isNextDisabled).toBe(true);
    });

    it('should disable next when isCreatingSkipJob', () => {
      const { result } = setup({ isCreatingSkipJob: true });
      expect(result.current.isNextDisabled).toBe(true);
    });
  });

  describe('isPreviousDisabled', () => {
    it('should disable previous when isSubmitting', () => {
      const { result } = setup({ isSubmitting: true });
      expect(result.current.isPreviousDisabled).toBe(true);
    });

    it('should disable previous when isCancelling', () => {
      const { result } = setup({ isCancelling: true });
      expect(result.current.isPreviousDisabled).toBe(true);
    });

    it('should disable previous when isStepRunning', () => {
      const { result } = setup({ isStepRunning: true });
      expect(result.current.isPreviousDisabled).toBe(true);
    });

    it('should disable previous when showCancelConfirmation is true', () => {
      const { result } = setup({ showCancelConfirmation: true });
      expect(result.current.isPreviousDisabled).toBe(true);
    });

    it('should enable previous when no blocking conditions', () => {
      const { result } = setup({
        isSubmitting: false,
        isCancelling: false,
        isStepRunning: false,
        showCancelConfirmation: false,
      });
      expect(result.current.isPreviousDisabled).toBe(false);
    });
  });
});
