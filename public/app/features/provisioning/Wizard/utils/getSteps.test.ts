import { getSteps, getSyncStepStatus } from './getSteps';

describe('getSteps', () => {
  const expectedStepOrder = ['authType', 'connection', 'bootstrap', 'synchronize', 'finish'];

  it('returns consistent step order across providers', () => {
    expect(getSteps('local').map((s) => s.id)).toEqual(expectedStepOrder);
    expect(getSteps('git').map((s) => s.id)).toEqual(expectedStepOrder);
    expect(getSteps('gitlab').map((s) => s.id)).toEqual(expectedStepOrder);
    expect(getSteps('bitbucket').map((s) => s.id)).toEqual(expectedStepOrder);
    expect(getSteps('github').map((s) => s.id)).toEqual(expectedStepOrder);
  });

  it('returns local-specific labels for step 1 and 2 when type is local', () => {
    const steps = getSteps('local');
    const authTypeStep = steps.find((s) => s.id === 'authType');
    const connectionStep = steps.find((s) => s.id === 'connection');

    expect(authTypeStep?.name).toBe('File provisioning');
    expect(authTypeStep?.title).toBe('File provisioning');
    expect(connectionStep?.name).toBe('Connect');
    expect(connectionStep?.title).toBe('Connect to external storage');
  });

  it('returns git-provider labels for step 1 and 2 when type is not local', () => {
    const steps = getSteps('github');
    const authTypeStep = steps.find((s) => s.id === 'authType');
    const connectionStep = steps.find((s) => s.id === 'connection');

    expect(authTypeStep?.name).toBe('Connect');
    expect(authTypeStep?.title).toBe('Connect');
    expect(connectionStep?.name).toBe('Configure repository');
    expect(connectionStep?.title).toBe('Configure repository');
  });
});

describe('getSyncStepStatus', () => {
  const defaultState = {
    hasError: false,
    isUnhealthy: false,
    isLoading: false,
    healthStatusNotReady: false,
    repositoryHealthMessages: undefined,
    goToStep: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns running when loading', () => {
    const result = getSyncStepStatus({ ...defaultState, isLoading: true, fieldErrors: undefined });
    expect(result.status).toBe('running');
  });

  it('returns running when health status not ready', () => {
    const result = getSyncStepStatus({ ...defaultState, healthStatusNotReady: true, fieldErrors: undefined });
    expect(result.status).toBe('running');
  });

  it('returns error when query has error', () => {
    const result = getSyncStepStatus({ ...defaultState, hasError: true, fieldErrors: undefined });
    expect(result.status).toBe('error');
    expect(result).toHaveProperty('error');
  });

  it('returns error with action when unhealthy with field errors', () => {
    const goToStep = jest.fn();
    const result = getSyncStepStatus({
      ...defaultState,
      isUnhealthy: true,
      fieldErrors: [{ field: 'secure.token', detail: 'Token is invalid', type: 'FieldValueInvalid' }],
      goToStep,
    });
    expect(result.status).toBe('error');
    expect(result).toHaveProperty('action');
    if ('action' in result && result.action?.onClick) {
      result.action.onClick();
      expect(goToStep).toHaveBeenCalledWith('authType');
    }
  });

  it('returns error without action when unhealthy without field errors', () => {
    const result = getSyncStepStatus({
      ...defaultState,
      isUnhealthy: true,
      repositoryHealthMessages: ['Token expired'],
      fieldErrors: undefined,
    });
    expect(result.status).toBe('error');
    expect(result).not.toHaveProperty('action');
    if ('error' in result && typeof result.error === 'object') {
      expect(result.error.message).toEqual(['Token expired']);
    }
  });

  it('returns idle when everything is healthy', () => {
    const result = getSyncStepStatus({ ...defaultState, fieldErrors: undefined });
    expect(result.status).toBe('idle');
  });

  it('prioritizes loading over error states', () => {
    const result = getSyncStepStatus({
      ...defaultState,
      isLoading: true,
      hasError: true,
      fieldErrors: undefined,
      isUnhealthy: true,
    });
    expect(result.status).toBe('running');
  });

  it('prioritizes hasError over isUnhealthy', () => {
    const result = getSyncStepStatus({
      ...defaultState,
      hasError: true,
      isUnhealthy: true,
      fieldErrors: [{ field: 'secure.token', detail: 'Token is invalid', type: 'FieldValueInvalid' }],
    });
    expect(result.status).toBe('error');
    expect(result).not.toHaveProperty('action');
  });

  it('navigates to connection step for branch field errors', () => {
    const goToStep = jest.fn();
    const result = getSyncStepStatus({
      ...defaultState,
      isUnhealthy: true,
      fieldErrors: [{ field: 'github.branch', detail: 'Branch not found', type: 'FieldValueInvalid' }],
      goToStep,
    });
    if ('action' in result && result.action?.onClick) {
      result.action.onClick();
      expect(goToStep).toHaveBeenCalledWith('connection');
    }
  });
});
