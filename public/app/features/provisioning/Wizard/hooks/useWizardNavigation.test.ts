import { act, renderHook } from '@testing-library/react';

import { PROVISIONING_URL } from '../../constants';
import { Step } from '../Stepper';
import { WizardFormData, WizardStep } from '../types';

import { useWizardNavigation, UseWizardNavigationParams } from './useWizardNavigation';

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@grafana/runtime', () => ({
  reportInteraction: jest.fn(),
}));

jest.mock('../../utils/data', () => ({
  getWorkflows: jest.fn(() => ['write']),
}));

describe('useWizardNavigation', () => {
  const mockSteps: Array<Step<WizardStep>> = [
    { id: 'authType', name: 'Auth Type', title: 'Select auth type' },
    { id: 'connection', name: 'Connection', title: 'Set up connection' },
    { id: 'bootstrap', name: 'Bootstrap', title: 'Bootstrap repository' },
    { id: 'synchronize', name: 'Synchronize', title: 'Synchronize' },
    { id: 'finish', name: 'Finish', title: 'Finish setup' },
  ];

  const mockFormData = {
    repository: {
      type: 'github',
      url: 'https://github.com/test/repo',
      title: 'Test Repo',
      sync: { enabled: true, target: 'folder' },
      readOnly: false,
      prWorkflow: false,
      enablePushToConfiguredBranch: false,
    },
  } as WizardFormData;

  const mockSetStepStatusInfo = jest.fn();
  const mockCreateSyncJob = jest.fn();
  const mockGetValues = jest.fn(() => mockFormData);

  const defaultParams: UseWizardNavigationParams = {
    initialStep: 'connection',
    steps: mockSteps,
    canSkipSync: false,
    setStepStatusInfo: mockSetStepStatusInfo,
    createSyncJob: mockCreateSyncJob,
    getValues: mockGetValues,
    repoType: 'github',
    syncTarget: 'folder',
    githubAuthType: 'pat',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setup(overrides: Partial<UseWizardNavigationParams> = {}) {
    const params = { ...defaultParams, ...overrides };
    return renderHook(() => useWizardNavigation(params));
  }

  describe('initial state', () => {
    it('should initialize with the provided initial step', () => {
      const { result } = setup({ initialStep: 'bootstrap' });
      expect(result.current.activeStep).toBe('bootstrap');
    });

    it('should initialize with empty completed steps', () => {
      const { result } = setup();
      expect(result.current.completedSteps).toEqual([]);
    });

    it('should calculate currentStepIndex correctly', () => {
      const { result } = setup({ initialStep: 'connection' });
      expect(result.current.currentStepIndex).toBe(1);
    });

    it('should calculate currentStepConfig correctly', () => {
      const { result } = setup({ initialStep: 'connection' });
      expect(result.current.currentStepConfig?.id).toBe('connection');
      expect(result.current.currentStepConfig?.name).toBe('Connection');
    });

    it('should calculate visibleStepIndex excluding authType step', () => {
      const { result } = setup({ initialStep: 'connection' });
      // authType is filtered out, so connection is at index 0
      expect(result.current.visibleStepIndex).toBe(0);
    });
  });

  describe('goToNextStep', () => {
    it('should advance to the next step', async () => {
      const { result } = setup({ initialStep: 'connection' });

      await act(async () => {
        await result.current.goToNextStep();
      });

      expect(result.current.activeStep).toBe('bootstrap');
      expect(result.current.completedSteps).toContain('connection');
    });

    it('should reset step status info when advancing', async () => {
      const { result } = setup({ initialStep: 'connection' });

      await act(async () => {
        await result.current.goToNextStep();
      });

      expect(mockSetStepStatusInfo).toHaveBeenCalledWith({ status: 'idle' });
    });

    it('should navigate to provisioning URL on last step', async () => {
      const { result } = setup({ initialStep: 'finish' });

      await act(async () => {
        await result.current.goToNextStep();
      });

      expect(mockNavigate).toHaveBeenCalledWith(PROVISIONING_URL);
    });

    it('should skip sync step and create job when canSkipSync is true', async () => {
      mockCreateSyncJob.mockResolvedValue({ success: true });
      const { result } = setup({
        initialStep: 'bootstrap',
        canSkipSync: true,
      });

      await act(async () => {
        await result.current.goToNextStep();
      });

      expect(mockCreateSyncJob).toHaveBeenCalledWith(false);
      expect(result.current.activeStep).toBe('finish');
    });

    it('should not advance if createSyncJob returns falsy', async () => {
      mockCreateSyncJob.mockResolvedValue(null);
      const { result } = setup({
        initialStep: 'bootstrap',
        canSkipSync: true,
      });

      await act(async () => {
        await result.current.goToNextStep();
      });

      expect(result.current.activeStep).toBe('bootstrap');
    });

    it('should navigate to provisioning URL if next step exceeds steps length', async () => {
      mockCreateSyncJob.mockResolvedValue({ success: true });
      // Create steps without finish step to test edge case
      const shortSteps: Array<Step<WizardStep>> = [
        { id: 'connection', name: 'Connection', title: 'Connection' },
        { id: 'bootstrap', name: 'Bootstrap', title: 'Bootstrap' },
      ];

      const { result } = setup({
        steps: shortSteps,
        initialStep: 'bootstrap',
        canSkipSync: true,
      });

      await act(async () => {
        await result.current.goToNextStep();
      });

      expect(mockNavigate).toHaveBeenCalledWith(PROVISIONING_URL);
    });
  });

  describe('goToPreviousStep', () => {
    it('should go back to the previous step', async () => {
      const { result } = setup({ initialStep: 'bootstrap' });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.activeStep).toBe('connection');
    });

    it('should remove current step from completed steps', async () => {
      const { result } = setup({ initialStep: 'connection' });

      await act(async () => {
        await result.current.goToNextStep();
      });
      expect(result.current.completedSteps).toContain('connection');

      act(() => {
        result.current.goToPreviousStep();
      });
      expect(result.current.completedSteps).not.toContain('bootstrap');
    });

    it('should reset step status info when going back', () => {
      const { result } = setup({ initialStep: 'bootstrap' });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(mockSetStepStatusInfo).toHaveBeenCalledWith({ status: 'idle' });
    });

    it('should not go back if already on first step', () => {
      const { result } = setup({ initialStep: 'authType' });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.activeStep).toBe('authType');
    });

    it('should skip sync step when going back from finish if canSkipSync is true', () => {
      const { result } = setup({
        initialStep: 'finish',
        canSkipSync: true,
      });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.activeStep).toBe('bootstrap');
    });
  });

  describe('markStepComplete', () => {
    it('should add step to completed steps', () => {
      const { result } = setup();

      act(() => {
        result.current.markStepComplete('connection');
      });

      expect(result.current.completedSteps).toContain('connection');
    });

    it('should not duplicate steps in completed steps', () => {
      const { result } = setup();

      act(() => {
        result.current.markStepComplete('connection');
        result.current.markStepComplete('connection');
      });

      const connectionCount = result.current.completedSteps.filter((s) => s === 'connection').length;
      expect(connectionCount).toBe(1);
    });
  });
});
