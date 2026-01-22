import { act, renderHook, waitFor } from '@testing-library/react';

import { PROVISIONING_URL } from '../../constants';
import { RepoType, WizardStep } from '../types';

import { useWizardCancellation, UseWizardCancellationParams } from './useWizardCancellation';

jest.mock('@grafana/runtime', () => ({
  reportInteraction: jest.fn(),
}));

describe('useWizardCancellation', () => {
  const mockDeleteRepository = jest.fn();
  const mockNavigate = jest.fn();
  const mockHandleBack = jest.fn();

  const defaultParams: UseWizardCancellationParams = {
    repoName: 'test-repo',
    repoType: 'github' as RepoType,
    activeStep: 'bootstrap' as WizardStep,
    deleteRepository: mockDeleteRepository,
    navigate: mockNavigate,
    handleBack: mockHandleBack,
    shouldUseCancelBehavior: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setup(overrides: Partial<UseWizardCancellationParams> = {}) {
    const params = { ...defaultParams, ...overrides };
    return renderHook(() => useWizardCancellation(params));
  }

  describe('initial state', () => {
    it('should initialize with isCancelling as false', () => {
      const { result } = setup();
      expect(result.current.isCancelling).toBe(false);
    });

    it('should initialize with showCancelConfirmation as false', () => {
      const { result } = setup();
      expect(result.current.showCancelConfirmation).toBe(false);
    });
  });

  describe('handlePrevious', () => {
    it('should navigate to provisioning URL when shouldUseCancelBehavior is true and no repoName', () => {
      const { result } = setup({
        shouldUseCancelBehavior: true,
        repoName: '',
      });

      act(() => {
        result.current.handlePrevious();
      });

      expect(mockNavigate).toHaveBeenCalledWith(PROVISIONING_URL);
      expect(result.current.showCancelConfirmation).toBe(false);
    });

    it('should show cancel confirmation when shouldUseCancelBehavior is true and repoName exists', () => {
      const { result } = setup({
        shouldUseCancelBehavior: true,
        repoName: 'test-repo',
      });

      act(() => {
        result.current.handlePrevious();
      });

      expect(result.current.showCancelConfirmation).toBe(true);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should show cancel confirmation on connection step when repoName exists', () => {
      const { result } = setup({
        activeStep: 'connection',
        repoName: 'test-repo',
        shouldUseCancelBehavior: false,
      });

      act(() => {
        result.current.handlePrevious();
      });

      expect(result.current.showCancelConfirmation).toBe(true);
    });

    it('should call handleBack when not in cancel behavior mode', () => {
      const { result } = setup({
        shouldUseCancelBehavior: false,
        activeStep: 'bootstrap',
        repoName: '',
      });

      act(() => {
        result.current.handlePrevious();
      });

      expect(mockHandleBack).toHaveBeenCalled();
    });
  });

  describe('handleConfirmCancel', () => {
    it('should hide confirmation and delete repository', async () => {
      mockDeleteRepository.mockResolvedValue({});

      const { result } = setup();

      act(() => {
        result.current.handlePrevious();
      });

      expect(result.current.showCancelConfirmation).toBe(false);

      const { result: resultWithConfirmation } = setup({
        shouldUseCancelBehavior: true,
      });

      act(() => {
        resultWithConfirmation.current.handlePrevious();
      });

      expect(resultWithConfirmation.current.showCancelConfirmation).toBe(true);

      await act(async () => {
        resultWithConfirmation.current.handleConfirmCancel();
      });

      expect(resultWithConfirmation.current.showCancelConfirmation).toBe(false);
      expect(mockDeleteRepository).toHaveBeenCalledWith({ name: 'test-repo' });
    });
  });

  describe('handleDismissCancel', () => {
    it('should hide cancel confirmation', () => {
      const { result } = setup({
        shouldUseCancelBehavior: true,
      });

      act(() => {
        result.current.handlePrevious();
      });
      expect(result.current.showCancelConfirmation).toBe(true);

      act(() => {
        result.current.handleDismissCancel();
      });
      expect(result.current.showCancelConfirmation).toBe(false);
    });
  });

  describe('handleRepositoryDeletion', () => {
    it('should set isCancelling to true and delete repository', async () => {
      mockDeleteRepository.mockResolvedValue({});

      const { result } = setup();

      await act(async () => {
        result.current.handleRepositoryDeletion('test-repo');
      });

      expect(result.current.isCancelling).toBe(true);
      expect(mockDeleteRepository).toHaveBeenCalledWith({ name: 'test-repo' });
    });

    it('should navigate after successful deletion', async () => {
      mockDeleteRepository.mockResolvedValue({});

      const { result } = setup();

      await act(async () => {
        result.current.handleRepositoryDeletion('test-repo');
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockNavigate).toHaveBeenCalledWith(PROVISIONING_URL);
    });

    it('should set isCancelling to false on error', async () => {
      mockDeleteRepository.mockRejectedValue(new Error('Delete failed'));

      const { result } = setup();

      await act(async () => {
        result.current.handleRepositoryDeletion('test-repo');
      });

      await waitFor(() => {
        expect(result.current.isCancelling).toBe(false);
      });
    });
  });

  describe('onDiscard', () => {
    it('should delete repository and call handlePrevious when repoName exists', async () => {
      mockDeleteRepository.mockResolvedValue({});

      const { result } = setup({
        repoName: 'test-repo',
        shouldUseCancelBehavior: false,
        activeStep: 'bootstrap',
      });

      await act(async () => {
        await result.current.onDiscard();
      });

      expect(mockDeleteRepository).toHaveBeenCalledWith({ name: 'test-repo' });
    });

    it('should only call handlePrevious when no repoName', async () => {
      const { result } = setup({
        repoName: '',
        shouldUseCancelBehavior: false,
        activeStep: 'bootstrap',
      });

      await act(async () => {
        await result.current.onDiscard();
      });

      expect(mockDeleteRepository).not.toHaveBeenCalled();
      expect(mockHandleBack).toHaveBeenCalled();
    });
  });
});
