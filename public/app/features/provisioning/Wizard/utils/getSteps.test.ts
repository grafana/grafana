import { getSteps } from './getSteps';

describe('getSteps', () => {
  it('should return steps without authType for non-GitHub types', () => {
    const steps = getSteps('local');
    const stepIds = steps.map((s) => s.id);

    expect(stepIds).not.toContain('authType');
    expect(stepIds).not.toContain('githubApp');
    expect(stepIds).toEqual(['connection', 'bootstrap', 'synchronize', 'finish']);
  });

  it('should return steps with authType but no githubApp for GitHub with PAT', () => {
    const steps = getSteps('github', 'pat');
    const stepIds = steps.map((s) => s.id);

    expect(stepIds).toContain('authType');
    expect(stepIds).not.toContain('githubApp');
    expect(stepIds).toEqual(['authType', 'connection', 'bootstrap', 'synchronize', 'finish']);
  });

  it('should return steps with both authType and githubApp for GitHub with github-app', () => {
    const steps = getSteps('github', 'github-app');
    const stepIds = steps.map((s) => s.id);

    expect(stepIds).toContain('authType');
    expect(stepIds).toContain('githubApp');
    expect(stepIds).toEqual(['authType', 'githubApp', 'connection', 'bootstrap', 'synchronize', 'finish']);
  });

  it('should have correct step properties', () => {
    const steps = getSteps('github', 'github-app');
    const connectionStep = steps.find((s) => s.id === 'connection');

    expect(connectionStep).toBeDefined();
    expect(connectionStep?.submitOnNext).toBe(true);
    expect(connectionStep?.name).toBeDefined();
    expect(connectionStep?.title).toBeDefined();
  });
});
