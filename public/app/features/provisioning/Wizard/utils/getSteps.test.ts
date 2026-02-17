import { getSteps } from './getSteps';

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
