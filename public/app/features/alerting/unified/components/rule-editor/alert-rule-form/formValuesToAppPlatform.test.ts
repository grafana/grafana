import { mockDataQuery, mockReduceExpression, mockThresholdExpression } from '../../../mocks';
import { getDefaultFormValues } from '../../../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../../../types/rule-form';

import { getNotificationSettings, toExpression } from './formValuesToAppPlatform';

describe('getNotificationSettings', () => {
  const baseValues: RuleFormValues = {
    ...getDefaultFormValues(),
    type: RuleFormType.grafana,
  };

  it('returns a NamedRoutingTree when a named policy is selected and manual routing is off', () => {
    const result = getNotificationSettings({
      ...baseValues,
      manualRouting: false,
      selectedPolicy: 'TestPolicy',
    });

    expect(result).toEqual({ type: 'NamedRoutingTree', routingTree: 'TestPolicy' });
  });

  it('returns undefined for the empty-string selectedPolicy (Default policy)', () => {
    const result = getNotificationSettings({
      ...baseValues,
      manualRouting: false,
      selectedPolicy: '',
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when neither selectedPolicy nor manual routing is set', () => {
    const result = getNotificationSettings({
      ...baseValues,
      manualRouting: false,
      selectedPolicy: undefined,
    });

    expect(result).toBeUndefined();
  });

  it('prefers manual routing over a stale selectedPolicy value', () => {
    const result = getNotificationSettings({
      ...baseValues,
      manualRouting: true,
      selectedPolicy: 'TestPolicy',
      contactPoints: {
        grafana: {
          selectedContactPoint: 'my-receiver',
          muteTimeIntervals: [],
          activeTimeIntervals: [],
          overrideGrouping: false,
          overrideTimings: false,
          groupBy: [],
          groupWaitValue: '',
          groupIntervalValue: '',
          repeatIntervalValue: '',
        },
      },
    });

    expect(result).toMatchObject({ type: 'SimplifiedRouting', receiver: 'my-receiver' });
  });

  it('returns a SimplifiedRouting when manual routing is on with a selected contact point', () => {
    const result = getNotificationSettings({
      ...baseValues,
      manualRouting: true,
      contactPoints: {
        grafana: {
          selectedContactPoint: 'team-receiver',
          muteTimeIntervals: ['mute1'],
          activeTimeIntervals: ['active1'],
          overrideGrouping: true,
          groupBy: ['alertname', 'cluster'],
          overrideTimings: true,
          groupWaitValue: '10s',
          groupIntervalValue: '5m',
          repeatIntervalValue: '4h',
        },
      },
    });

    expect(result).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'team-receiver',
      muteTimeIntervals: ['mute1'],
      activeTimeIntervals: ['active1'],
      groupBy: ['alertname', 'cluster'],
      groupWait: '10s',
      groupInterval: '5m',
      repeatInterval: '4h',
    });
  });

  it('returns undefined when manual routing is on but no contact point is selected', () => {
    const result = getNotificationSettings({
      ...baseValues,
      manualRouting: true,
      contactPoints: {},
    });

    expect(result).toBeUndefined();
  });
});

describe('toExpression', () => {
  it('does not include relativeTimeRange for a reduce expression, even if form state has one', () => {
    const query = { ...mockReduceExpression(), relativeTimeRange: { from: 0, to: 0 } };

    const result = toExpression(query, 'B');

    expect(result.relativeTimeRange).toBeUndefined();
  });

  it('does not include relativeTimeRange for a threshold expression, even if form state has one', () => {
    const query = { ...mockThresholdExpression(), relativeTimeRange: { from: 0, to: 0 } };

    const result = toExpression(query, 'C');

    expect(result.relativeTimeRange).toBeUndefined();
  });

  it('leaves expressions without a relativeTimeRange in form state unaffected', () => {
    const result = toExpression(mockReduceExpression(), 'B');

    expect(result.relativeTimeRange).toBeUndefined();
  });

  it('omits relativeTimeRange for a data-source query when form state has none', () => {
    const result = toExpression(mockDataQuery(), 'A');

    expect(result.relativeTimeRange).toBeUndefined();
  });

  it('still includes relativeTimeRange for a data-source query', () => {
    const query = { ...mockDataQuery(), relativeTimeRange: { from: 600, to: 0 } };

    const result = toExpression(query, 'A');

    expect(result.relativeTimeRange).toEqual({ from: '600s', to: '0s' });
    expect(result.datasourceUID).toBe('abc123');
  });

  it('marks the refId matching the condition as the source, expression or not', () => {
    const result = toExpression(mockThresholdExpression(), 'C');

    expect(result.source).toBe(true);
  });
});
