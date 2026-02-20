import { act, renderHook } from '@testing-library/react';
import { UseFormReturn } from 'react-hook-form';

import { Step } from '../Stepper';
import { WizardFormData, WizardStep } from '../types';

import { useWizardSubmission, UseWizardSubmissionParams } from './useWizardSubmission';

jest.mock('@grafana/i18n', () => ({
  t: jest.fn((key: string, defaultValue: string) => defaultValue),
}));

jest.mock('@grafana/runtime', () => ({
  isFetchError: jest.fn((error) => error?.data !== undefined),
}));

jest.mock('../../utils/data', () => ({
  dataToSpec: jest.fn(() => ({ type: 'github', github: { url: 'https://github.com/test/repo' } })),
}));

jest.mock('../../utils/getFormErrors', () => ({
  getFormErrors: jest.fn(() => [['repository.url', { message: 'Invalid URL' }]]),
}));

describe('useWizardSubmission', () => {
  const mockSubmitData = jest.fn();
  const mockSetStepStatusInfo = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockSetValue = jest.fn();
  const mockTrigger = jest.fn();
  const mockSetError = jest.fn();
  const mockGetValues = jest.fn();

  const connectionStep: Step<WizardStep> = {
    id: 'connection',
    name: 'Connection',
    title: 'Set up connection',
    submitOnNext: true,
    formFields: ['repository.branch', 'repository.path'],
  };

  const bootstrapStep: Step<WizardStep> = {
    id: 'bootstrap',
    name: 'Bootstrap',
    title: 'Bootstrap repository',
    submitOnNext: false,
  };

  const authTypeStep: Step<WizardStep> = {
    id: 'authType',
    name: 'Auth Type',
    title: 'Select auth type',
    submitOnNext: true,
    formFields: ['repository.url', 'repository.token', 'repository.tokenUser'],
  };

  function createMockMethods() {
    return {
      getValues: mockGetValues,
      trigger: mockTrigger,
      setError: mockSetError,
      setValue: mockSetValue,
    } as unknown as UseFormReturn<WizardFormData>;
  }

  function createParams(overrides: Partial<UseWizardSubmissionParams> = {}): UseWizardSubmissionParams {
    return {
      activeStep: 'connection',
      currentStepConfig: connectionStep,
      methods: createMockMethods(),
      submitData: mockSubmitData,
      setStepStatusInfo: mockSetStepStatusInfo,
      onSuccess: mockOnSuccess,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetValues.mockReturnValue({
      repository: {
        type: 'github',
        url: 'https://github.com/test/repo',
      },
      githubAuthType: 'pat',
    });
    mockTrigger.mockResolvedValue(true);
  });

  describe('initial state', () => {
    it('should initialize with isSubmitting as false', () => {
      const { result } = renderHook(() => useWizardSubmission(createParams()));
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('handleSubmit', () => {
    describe('when submitOnNext is false', () => {
      it('should call onSuccess directly', async () => {
        const { result } = renderHook(() =>
          useWizardSubmission(
            createParams({
              activeStep: 'bootstrap',
              currentStepConfig: bootstrapStep,
            })
          )
        );

        await act(async () => {
          await result.current.handleSubmit();
        });

        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockSubmitData).not.toHaveBeenCalled();
      });
    });

    describe('when submitOnNext is true', () => {
      describe('connection step', () => {
        it('should validate and submit data', async () => {
          mockSubmitData.mockResolvedValue({
            data: { metadata: { name: 'new-repo' } },
          });

          const { result } = renderHook(() => useWizardSubmission(createParams()));

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockTrigger).toHaveBeenCalledWith(['repository']);
          expect(mockSubmitData).toHaveBeenCalled();
          expect(mockSetValue).toHaveBeenCalledWith('repositoryName', 'new-repo');
          expect(mockOnSuccess).toHaveBeenCalled();
        });

        it('should not submit if validation fails', async () => {
          mockTrigger.mockResolvedValue(false);

          const { result } = renderHook(() => useWizardSubmission(createParams()));

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockSubmitData).not.toHaveBeenCalled();
        });

        it('should set error status on fetch error', async () => {
          mockSubmitData.mockResolvedValue({
            error: { data: { message: 'Repository request failed' } },
          });

          const { result } = renderHook(() => useWizardSubmission(createParams()));

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockSetStepStatusInfo).toHaveBeenCalledWith({
            status: 'error',
            error: {
              title: 'Repository request failed',
              message: 'Repository request failed',
            },
          });
        });

        it('should set error status on non-fetch error', async () => {
          mockSubmitData.mockResolvedValue({
            error: new Error('Unknown error'),
          });

          const { result } = renderHook(() => useWizardSubmission(createParams()));

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockSetStepStatusInfo).toHaveBeenCalledWith({
            status: 'error',
            error: 'Repository request failed',
          });
        });
      });

      describe('authType step', () => {
        it('should validate repository fields for authType step', async () => {
          mockGetValues.mockReturnValue({
            repository: { type: 'github' },
            githubAuthType: 'pat',
          });
          mockTrigger.mockResolvedValue(true);

          // AuthType submit should succeed so onSuccess is called
          mockSubmitData.mockResolvedValue({
            data: { metadata: { name: 'test-repo' } },
          });

          const { result } = renderHook(() =>
            useWizardSubmission(
              createParams({
                activeStep: 'authType',
                currentStepConfig: authTypeStep,
              })
            )
          );

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockTrigger).toHaveBeenCalledWith(['repository']);
          expect(mockSubmitData).toHaveBeenCalled();
          expect(mockOnSuccess).toHaveBeenCalled();
        });
      });
    });

    describe('error handling', () => {
      it('should set inline error for fields visible on the current step', async () => {
        mockSubmitData.mockRejectedValue({
          data: {
            message: 'Validation failed',
            errors: { 'repository.url': 'Invalid URL' },
          },
        });

        const { result } = renderHook(() => useWizardSubmission(createParams()));

        await act(async () => {
          await result.current.handleSubmit();
        });

        // repository.url belongs to the authType step, not the connection step,
        // so setError should NOT be called (prevents phantom errors blocking retry)
        expect(mockSetError).not.toHaveBeenCalled();

        // The error should appear in the step status banner instead
        expect(mockSetStepStatusInfo).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'error',
            error: expect.objectContaining({ message: 'Invalid URL' }),
          })
        );
      });

      it('should set inline error for fields visible on the authType step', async () => {
        mockSubmitData.mockRejectedValue({
          data: {
            message: 'Validation failed',
            errors: { 'repository.url': 'Invalid URL' },
          },
        });

        const { result } = renderHook(() =>
          useWizardSubmission(
            createParams({
              activeStep: 'authType',
              currentStepConfig: authTypeStep,
            })
          )
        );

        await act(async () => {
          await result.current.handleSubmit();
        });

        // repository.url IS visible on authType step, so setError should be called
        expect(mockSetError).toHaveBeenCalledWith('repository.url', {
          message: 'Invalid URL',
        });
      });

      it('should handle non-fetch thrown errors', async () => {
        mockSubmitData.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useWizardSubmission(createParams()));

        await act(async () => {
          await result.current.handleSubmit();
        });

        expect(mockSetStepStatusInfo).toHaveBeenCalledWith({
          status: 'error',
          error: 'Repository connection failed',
        });
      });

      it('should reset isSubmitting after error', async () => {
        mockSubmitData.mockRejectedValue(new Error('Error'));

        const { result } = renderHook(() => useWizardSubmission(createParams()));

        await act(async () => {
          await result.current.handleSubmit();
        });

        expect(result.current.isSubmitting).toBe(false);
      });
    });

    describe('GitHub app auth type', () => {
      it('should include connection name when githubAuthType is github-app', async () => {
        mockGetValues.mockReturnValue({
          repository: { type: 'github', url: 'https://github.com/test/repo' },
          githubAuthType: 'github-app',
          githubApp: { connectionName: 'my-connection' },
        });
        mockSubmitData.mockResolvedValue({
          data: { metadata: { name: 'new-repo' } },
        });

        const { result } = renderHook(() => useWizardSubmission(createParams()));

        await act(async () => {
          await result.current.handleSubmit();
        });

        expect(mockSubmitData).toHaveBeenCalled();
      });

      it('should include token when githubAuthType is pat', async () => {
        mockGetValues.mockReturnValue({
          repository: { type: 'github', url: 'https://github.com/test/repo', token: 'my-token' },
          githubAuthType: 'pat',
        });
        mockSubmitData.mockResolvedValue({
          data: { metadata: { name: 'new-repo' } },
        });

        const { result } = renderHook(() => useWizardSubmission(createParams()));

        await act(async () => {
          await result.current.handleSubmit();
        });

        expect(mockSubmitData).toHaveBeenCalled();
      });
    });
  });
});
