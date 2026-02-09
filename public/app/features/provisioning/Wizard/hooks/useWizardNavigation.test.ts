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
    it('should initialize with authType step', () => {
      const { result } = setup();
      expect(result.current.activeStep).toBe('authType');
    });

    it('should initialize with empty completed steps', () => {
      const { result } = setup();
      expect(result.current.completedSteps).toEqual([]);
    });

    it('should calculate currentStepIndex correctly', () => {
      const { result } = setup();
      expect(result.current.currentStepIndex).toBe(0); // authType is the first step, setup initializes with it
    });

    it('should calculate currentStepConfig correctly', () => {
      const { result } = setup();
      expect(result.current.currentStepConfig?.id).toBe('authType');
      expect(result.current.currentStepConfig?.name).toBe('Auth Type');
    });
  });

  describe('goToNextStep', () => {
    it('should advance to the next step', () => {
      const { result } = setup();

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.activeStep).toBe('connection');
      expect(result.current.completedSteps).toContain('authType');
    });

    it('should reset step status info when advancing', async () => {
      const { result } = setup();

      act(() => {
        result.current.goToNextStep();
      });

      expect(mockSetStepStatusInfo).toHaveBeenCalledWith({ status: 'idle' });
    });

    it('should navigate to provisioning URL on last step', async () => {
      const { result } = setup();

      const go = (times: number) => {
        for (let i = 0; i < times; i++) {
          act(() => {
            result.current.goToNextStep();
          });
        }
      };

      go(5); // Go through all steps to reach last step
      expect(mockNavigate).toHaveBeenCalledWith(PROVISIONING_URL);
    });

    it('should skip sync step and create job in background when canSkipSync is true', async () => {
      mockCreateSyncJob.mockResolvedValue({ success: true });
      const { result } = setup({
        canSkipSync: true,
      });

      act(() => {
        result.current.goToNextStep(); // authType -> connection
      });
      act(() => {
        result.current.goToNextStep(); // connection -> bootstrap
      });
      act(() => {
        result.current.goToNextStep(); // bootstrap -> finish (skip sync)
      });

      // Job is created in background with skipStatusUpdates
      expect(mockCreateSyncJob).toHaveBeenCalledWith(false, { skipStatusUpdates: true });
      expect(result.current.activeStep).toBe('finish');
    });

    it('should navigate immediately even if createSyncJob fails', async () => {
      mockCreateSyncJob.mockResolvedValue(null);
      const { result } = setup({
        canSkipSync: true,
      });

      act(() => {
        result.current.goToNextStep(); // authType -> connection
      });
      act(() => {
        result.current.goToNextStep(); // connection -> bootstrap
      });
      act(() => {
        result.current.goToNextStep(); // bootstrap -> finish (skip sync)
      });

      // Job creation is attempted but navigation happens regardless
      expect(mockCreateSyncJob).toHaveBeenCalledWith(false, { skipStatusUpdates: true });
      // Navigation still proceeds (fire-and-forget)
      expect(result.current.activeStep).toBe('finish');
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
        canSkipSync: true,
      });

      act(() => {
        result.current.goToNextStep(); // authType -> connection
      });
      act(() => {
        result.current.goToNextStep(); // connection -> bootstrap
      });
      act(() => {
        result.current.goToNextStep(); // bootstrap -> navigate (no next step)
      });

      // Navigation proceeds to provisioning URL since finish step doesn't exist
      // Note: Job creation is tested in the "should skip sync step" test above
      expect(mockNavigate).toHaveBeenCalledWith(PROVISIONING_URL);
    });
  });

  describe('goToPreviousStep', () => {
    it('should go back to the previous step', async () => {
      const { result } = setup();

      act(() => {
        result.current.goToNextStep(); // authType -> connection
      });

      act(() => {
        result.current.goToNextStep(); // connection -> bootstrap
      });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.activeStep).toBe('connection');
    });

    it('should remove current step from completed steps', async () => {
      const { result } = setup();

      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.completedSteps).toContain('authType');

      act(() => {
        result.current.goToPreviousStep();
      });
      expect(result.current.completedSteps).not.toContain('connection');
    });

    it('should reset step status info when going back', () => {
      const { result } = setup();

      act(() => {
        result.current.goToNextStep(); // authType -> connection
      });
      act(() => {
        result.current.goToPreviousStep(); // connection -> authType
      });

      expect(mockSetStepStatusInfo).toHaveBeenCalledWith({ status: 'idle' });
    });

    it('should not go back if already on first step', () => {
      const { result } = setup();

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.activeStep).toBe('authType');
    });

    it('should skip sync step when going back from finish if canSkipSync is true', () => {
      const { result } = setup({
        canSkipSync: true,
      });

      act(() => {
        result.current.goToNextStep(); // authType -> connection
      });
      act(() => {
        result.current.goToNextStep(); // connection -> bootstrap
      });
      act(() => {
        result.current.goToNextStep(); // bootstrap -> finish (skip sync)
      });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.activeStep).toBe('bootstrap');
    });
  });
});
