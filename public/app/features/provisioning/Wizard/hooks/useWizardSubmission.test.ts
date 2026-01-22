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
  getFormErrors: jest.fn(() => ['repository.url', { type: 'manual', message: 'Invalid URL' }]),
}));

describe('useWizardSubmission', () => {
  const mockSubmitData = jest.fn();
  const mockSetStepStatusInfo = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockSetValue = jest.fn();
  const mockTrigger = jest.fn();
  const mockSetError = jest.fn();
  const mockGetValues = jest.fn();
  const mockGithubAppSubmit = jest.fn();

  const connectionStep: Step<WizardStep> = {
    id: 'connection',
    name: 'Connection',
    title: 'Set up connection',
    submitOnNext: true,
  };

  const bootstrapStep: Step<WizardStep> = {
    id: 'bootstrap',
    name: 'Bootstrap',
    title: 'Bootstrap repository',
    submitOnNext: false,
  };

  const githubAppStep: Step<WizardStep> = {
    id: 'githubApp',
    name: 'GitHub App',
    title: 'Configure GitHub App',
    submitOnNext: true,
  };

  const authTypeStep: Step<WizardStep> = {
    id: 'authType',
    name: 'Auth Type',
    title: 'Select auth type',
    submitOnNext: false,
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
      githubAppStepRef: {
        current: {
          submit: mockGithubAppSubmit,
        },
      } as UseWizardSubmissionParams['githubAppStepRef'],
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

      it('should call onSuccess on authType step when githubAuthType is set', async () => {
        mockGetValues.mockReturnValue({
          repository: { type: 'github' },
          githubAuthType: 'pat',
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

        expect(mockOnSuccess).toHaveBeenCalled();
      });

      it('should not call onSuccess on authType step when githubAuthType is not set', async () => {
        mockGetValues.mockReturnValue({
          repository: { type: 'github' },
          githubAuthType: undefined,
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

        expect(mockOnSuccess).not.toHaveBeenCalled();
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

      describe('githubApp step', () => {
        it('should validate and call onSuccess for existing mode', async () => {
          mockGetValues.mockReturnValue({
            repository: { type: 'github' },
            githubAppMode: 'existing',
            githubApp: { connectionName: 'my-app' },
          });
          mockTrigger.mockResolvedValue(true);

          const { result } = renderHook(() =>
            useWizardSubmission(
              createParams({
                activeStep: 'githubApp',
                currentStepConfig: githubAppStep,
              })
            )
          );

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockTrigger).toHaveBeenCalledWith('githubApp.connectionName');
          expect(mockOnSuccess).toHaveBeenCalled();
        });

        it('should not call onSuccess if existing mode validation fails', async () => {
          mockGetValues.mockReturnValue({
            repository: { type: 'github' },
            githubAppMode: 'existing',
            githubApp: { connectionName: '' },
          });
          mockTrigger.mockResolvedValue(false);

          const { result } = renderHook(() =>
            useWizardSubmission(
              createParams({
                activeStep: 'githubApp',
                currentStepConfig: githubAppStep,
              })
            )
          );

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockOnSuccess).not.toHaveBeenCalled();
        });

        it('should call githubAppStepRef.submit for new mode', async () => {
          mockGetValues.mockReturnValue({
            repository: { type: 'github' },
            githubAppMode: 'new',
          });
          mockGithubAppSubmit.mockResolvedValue(undefined);

          const { result } = renderHook(() =>
            useWizardSubmission(
              createParams({
                activeStep: 'githubApp',
                currentStepConfig: githubAppStep,
              })
            )
          );

          await act(async () => {
            await result.current.handleSubmit();
          });

          expect(mockGithubAppSubmit).toHaveBeenCalled();
        });
      });
    });

    describe('error handling', () => {
      it('should handle thrown fetch errors with form field errors', async () => {
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

        expect(mockSetError).toHaveBeenCalledWith('repository.url', {
          type: 'manual',
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
