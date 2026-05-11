import { AlertState, type AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

import { getAlertGroupsKey } from './utils';

const makeGroup = (...fingerprints: string[]): AlertmanagerGroup => ({
  labels: {},
  receiver: { name: 'recv' },
  alerts: fingerprints.map((fingerprint) => ({
    fingerprint,
    startsAt: '',
    updatedAt: '',
    endsAt: '',
    labels: {},
    annotations: {},
    receivers: [],
    status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
  })),
});

describe('getAlertGroupsKey', () => {
  it('returns an empty string for no groups', () => {
    expect(getAlertGroupsKey([])).toBe('');
  });

  it('returns fingerprints joined by comma across groups', () => {
    const groups = [makeGroup('fp1', 'fp2'), makeGroup('fp3')];
    expect(getAlertGroupsKey(groups)).toBe('fp1,fp2,fp3');
  });

  it('returns a single fingerprint for one alert in one group', () => {
    expect(getAlertGroupsKey([makeGroup('abc')])).toBe('abc');
  });

  it('produces different keys when fingerprints differ', () => {
    const a = getAlertGroupsKey([makeGroup('fp1')]);
    const b = getAlertGroupsKey([makeGroup('fp2')]);
    expect(a).not.toBe(b);
  });

  it('produces different keys when alert count changes', () => {
    const a = getAlertGroupsKey([makeGroup('fp1')]);
    const b = getAlertGroupsKey([makeGroup('fp1', 'fp2')]);
    expect(a).not.toBe(b);
  });
});
