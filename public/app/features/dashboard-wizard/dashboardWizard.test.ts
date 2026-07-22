import { buildDisplayPrompt, buildGenerationPrompt, buildRepairPrompt } from './prompts';
import { validateGeneratedDashboard } from './validateGeneratedDashboard';

describe('buildDisplayPrompt', () => {
  it('is just the user request when there are no clarifications', () => {
    expect(buildDisplayPrompt({ request: 'Monitor my checkout service' })).toBe('Monitor my checkout service');
    expect(buildDisplayPrompt({ request: 'Monitor my checkout service', clarifications: [] })).toBe(
      'Monitor my checkout service'
    );
  });

  it('lists the answered clarifications under the request', () => {
    const prompt = buildDisplayPrompt({
      request: 'Monitor my checkout service',
      clarifications: [{ question: 'Which environment?', answer: 'production' }],
    });
    expect(prompt).toBe('Monitor my checkout service\n\nMy choices:\n- Which environment? production');
  });

  it('lists the plan changes the user asked for on the review step', () => {
    const prompt = buildDisplayPrompt({
      request: 'Monitor my checkout service',
      clarifications: [{ question: 'Which environment?', answer: 'production' }],
      planFeedback: ['Add a latency section', 'Drop the logs tab'],
    });
    expect(prompt).toBe(
      'Monitor my checkout service\n\n' +
        'My choices:\n- Which environment? production\n\n' +
        'Changes I asked for on the plan:\n- Add a latency section\n- Drop the logs tab'
    );
  });
});

describe('buildGenerationPrompt', () => {
  it('renders plan repeats and instructs the builder to use the layout repeat option', () => {
    const prompt = buildGenerationPrompt({
      intent: 'Monitor the checkout service.',
      clarifications: [],
      datasources: [{ uid: 'prom-1', type: 'prometheus' }],
      summary: {
        title: 'Checkout service health',
        description: 'Monitors checkout.',
        structure: 'tabs',
        sections: [
          {
            title: 'Latency — $endpoint',
            kind: 'tab',
            repeatFor: 'endpoint',
            panels: [{ title: 'Latency percentiles', visualization: 'time series', repeatFor: undefined }],
          },
          {
            title: 'Traffic',
            kind: 'tab',
            panels: [{ title: 'Requests per instance', visualization: 'time series', repeatFor: 'instance' }],
          },
        ],
        variables: ['endpoint', 'instance'],
      },
    });

    expect(prompt).toContain('Tab "Latency — $endpoint", repeated for each value of $endpoint:');
    expect(prompt).toContain('- Requests per instance (time series; repeated for each value of $instance)');
    // The builder must realize repeats with the layout repeat option, not copies.
    expect(prompt).toContain('layout repeat option');
    expect(prompt).toContain('NEVER hand-build one copy per value');
  });
});

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
