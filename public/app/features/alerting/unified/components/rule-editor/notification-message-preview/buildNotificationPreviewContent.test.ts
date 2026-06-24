import {
  annotationsArrayToRecord,
  buildNotificationPreviewContent,
} from './buildNotificationPreviewContent';
import { actionabilitySeverity, computeActionabilityScore } from './computeActionabilityScore';

describe('buildNotificationPreviewContent', () => {
  it('prefers summary when configured', () => {
    const content = buildNotificationPreviewContent({
      ruleName: 'High CPU',
      annotations: { summary: 'CPU above 90% on {{ $labels.instance }}', description: 'Scale the deployment' },
    });

    expect(content.primaryLine).toBe('CPU above 90% on {{ $labels.instance }}');
    expect(content.secondaryLine).toBe('Scale the deployment');
    expect(content.title).toBe('[FIRING:1] High CPU');
  });

  it('falls back to description when summary is empty', () => {
    const content = buildNotificationPreviewContent({
      ruleName: 'High CPU',
      annotations: { description: 'Only a description' },
    });

    expect(content.primaryLine).toBe('Only a description');
    expect(content.secondaryLine).toBeUndefined();
  });

  it('falls back to rule name when annotations are empty', () => {
    const content = buildNotificationPreviewContent({
      ruleName: 'High CPU',
      annotations: {},
    });

    expect(content.primaryLine).toBe('High CPU');
    expect(content.secondaryLine).toBeUndefined();
  });
});

describe('annotationsArrayToRecord', () => {
  it('drops empty keys and values', () => {
    expect(
      annotationsArrayToRecord([
        { key: 'summary', value: 'ok' },
        { key: '', value: 'ignored' },
        { key: 'description', value: '' },
      ])
    ).toEqual({ summary: 'ok' });
  });
});

describe('computeActionabilityScore', () => {
  it('scores a fully actionable alert at 100', () => {
    const result = computeActionabilityScore({
      annotations: {
        summary: 'CPU high',
        description: 'Check pods',
        runbook_url: 'https://example.com/runbook',
      },
      labelCount: 3,
    });

    expect(result.score).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('scores an incomplete alert low', () => {
    const result = computeActionabilityScore({
      annotations: {},
      labelCount: 0,
    });

    expect(result.score).toBe(0);
    expect(actionabilitySeverity(result.score)).toBe('error');
  });
});
