import { buildRepairPrompt } from './prompts';
import { validateGeneratedDashboard } from './validateGeneratedDashboard';

describe('buildRepairPrompt', () => {
  it('lists undefined variables with a $ prefix and instructs a fix', () => {
    const prompt = buildRepairPrompt({ undefinedVariables: ['job', 'instance'] });
    expect(prompt).toContain('$job');
    expect(prompt).toContain('$instance');
    expect(prompt).toContain('NOT defined');
    // Repair passes must not persist the dashboard.
    expect(prompt).toContain('Do NOT save');
  });

  it('still produces a valid prompt when there is nothing to fix', () => {
    const prompt = buildRepairPrompt({ undefinedVariables: [] });
    expect(prompt).toContain('Do NOT save');
    expect(prompt).not.toContain('template variables that are NOT defined');
  });
});

describe('validateGeneratedDashboard', () => {
  afterEach(() => {
    // The context is a non-optional global; reset it between tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__grafanaSceneContext = undefined;
  });

  it('reports no issues when there is no active dashboard scene', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__grafanaSceneContext = undefined;
    expect(validateGeneratedDashboard()).toEqual({ undefinedVariables: [] });
  });

  it('reports no issues when the active scene is not a DashboardScene', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__grafanaSceneContext = { some: 'other-scene' };
    expect(validateGeneratedDashboard()).toEqual({ undefinedVariables: [] });
  });
});
