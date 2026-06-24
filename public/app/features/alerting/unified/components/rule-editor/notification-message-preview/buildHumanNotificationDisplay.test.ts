import {
  buildHumanNotificationDisplay,
  shouldShowRawTemplateOutput,
  stripFiringPrefix,
} from './buildHumanNotificationDisplay';

describe('buildHumanNotificationDisplay', () => {
  it('strips firing prefix from rendered titles', () => {
    expect(stripFiringPrefix('[FIRING:1] High CPU')).toBe('High CPU');
  });

  it('prefers summary and description for the human view', () => {
    const display = buildHumanNotificationDisplay({
      ruleName: 'High CPU',
      annotations: { summary: 'CPU above 90%', description: 'Scale the deployment' },
      renderedTitle: '[FIRING:1] High CPU',
    });

    expect(display).toEqual({
      title: 'High CPU',
      body: 'CPU above 90%',
      secondary: 'Scale the deployment',
    });
  });

  it('shows raw template output only when it differs from the human view', () => {
    const human = buildHumanNotificationDisplay({
      ruleName: 'High CPU',
      annotations: { summary: 'CPU above 90%' },
    });

    expect(shouldShowRawTemplateOutput('CPU above 90%', human)).toBe(false);
    expect(shouldShowRawTemplateOutput('**Firing**\nValue: A=92', human)).toBe(true);
  });
});
