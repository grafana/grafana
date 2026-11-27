import { getAlertRuleStatus, getRecordingRuleStatus } from './ruleStatus';

type AlertInput = Parameters<typeof getAlertRuleStatus>[0];
type RecordingInput = Parameters<typeof getRecordingRuleStatus>[0];

describe('getAlertRuleStatus', () => {
  it.each<{ name: string; rule: AlertInput; label: string; icon: string }>([
    { name: 'state Firing', rule: { state: 'Firing', health: 'OK' }, label: 'Firing', icon: 'fire' },
    { name: 'state Pending', rule: { state: 'Pending', health: 'OK' }, label: 'Pending', icon: 'hourglass' },
    {
      name: 'state Recovering',
      rule: { state: 'Recovering', health: 'OK' },
      label: 'Recovering',
      icon: 'exclamation-circle',
    },
    { name: 'state Healthy', rule: { state: 'Healthy', health: 'OK' }, label: 'Normal', icon: 'check-circle' },
    { name: 'state Inactive', rule: { state: 'Inactive', health: 'OK' }, label: 'Normal', icon: 'check-circle' },
    {
      name: 'health Error over state Firing',
      rule: { state: 'Firing', health: 'Error' },
      label: 'Failed to evaluate rule',
      icon: 'times-circle',
    },
    {
      name: 'health NoData over state Firing',
      rule: { state: 'Firing', health: 'NoData' },
      label: 'Insufficient data',
      icon: 'exclamation-triangle',
    },
    {
      name: 'paused over state Firing',
      rule: { state: 'Firing', health: 'OK', paused: true },
      label: 'Paused',
      icon: 'pause',
    },
    { name: 'paused over health Unknown', rule: { health: 'Unknown', paused: true }, label: 'Paused', icon: 'pause' },
    {
      name: 'stale health Paused with paused=false',
      rule: { state: 'Healthy', health: 'Paused', paused: false },
      label: 'Normal',
      icon: 'check-circle',
    },
    {
      name: 'stale health Paused with paused unset',
      rule: { state: 'Healthy', health: 'Paused' },
      label: 'Normal',
      icon: 'check-circle',
    },
    { name: 'no status at all', rule: {}, label: 'Status unavailable', icon: 'circle' },
    { name: 'health OK without a state', rule: { health: 'OK' }, label: 'Status unavailable', icon: 'circle' },
    {
      name: 'health Unknown without a state',
      rule: { health: 'Unknown' },
      label: 'Status unavailable',
      icon: 'circle',
    },
  ])('is "$label" for $name', ({ rule, label, icon }) => {
    expect(getAlertRuleStatus(rule)).toMatchObject({ label, icon });
  });
});

describe('getRecordingRuleStatus', () => {
  it.each<{ name: string; rule: RecordingInput; label: string; icon: string }>([
    { name: 'health Recording', rule: { health: 'Recording' }, label: 'Recording', icon: 'square-shape' },
    { name: 'health Error', rule: { health: 'Error' }, label: 'Failed to evaluate rule', icon: 'times-circle' },
    { name: 'paused', rule: { health: 'Recording', paused: true }, label: 'Paused', icon: 'pause' },
    { name: 'no health', rule: {}, label: 'Status unavailable', icon: 'square-shape' },
    { name: 'health Unknown', rule: { health: 'Unknown' }, label: 'Status unavailable', icon: 'square-shape' },
  ])('is "$label" for $name', ({ rule, label, icon }) => {
    expect(getRecordingRuleStatus(rule)).toMatchObject({ label, icon });
  });
});
