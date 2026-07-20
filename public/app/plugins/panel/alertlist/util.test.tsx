import { createTheme, MappingType, ThresholdsMode } from '@grafana/data';
import { BigValueColorMode } from '@grafana/ui';
import { mockAlertWithState as withState } from 'app/features/alerting/unified/mocks';
import { type Alert } from 'app/types/unified-alerting';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { GroupMode, SortOrder, STAT_THRESHOLDS_DEFAULT, type UnifiedAlertListOptions, ViewMode } from './types';
import { buildAlertingListUrl, filterAlerts, getStatDisplayValue } from './util';

const defaultOption: UnifiedAlertListOptions = {
  maxItems: 2,
  sortOrder: SortOrder.AlphaAsc,
  dashboardAlerts: true,
  groupMode: GroupMode.Default,
  groupBy: [''],
  alertName: 'test',
  showInstances: false,
  folder: { uid: 'abc', title: 'test folder' },
  stateFilter: { firing: true, pending: true, noData: true, normal: true, error: true, recovering: false },
  alertInstanceLabelFilter: '',
  datasource: 'Alertmanager',
  viewMode: ViewMode.List,
  showInactiveAlerts: false,
  statColorMode: BigValueColorMode.None,
  statThresholds: STAT_THRESHOLDS_DEFAULT,
  statValueMappings: [],
};

const alerts: Alert[] = [
  withState(GrafanaAlertState.Pending, { severity: 'critical' }),
  withState(GrafanaAlertState.Error, { severity: 'low' }),
  withState(GrafanaAlertState.Error, { region: 'asia' }),
  withState(GrafanaAlertState.Normal),
];

describe('filterAlerts', () => {
  it('Returns all alert instances when there are no filters', () => {
    const result = filterAlerts(defaultOption, alerts);

    expect(result.length).toBe(4);
  });

  it('Filters by alert instance state ', () => {
    const noNormalStateOptions = {
      ...defaultOption,
      ...{ stateFilter: { firing: true, pending: true, noData: true, normal: false, error: true, recovering: false } },
    };

    expect(filterAlerts(noNormalStateOptions, alerts).length).toBe(3);

    const noErrorOrNormalStateOptions = {
      ...defaultOption,
      ...{ stateFilter: { firing: true, pending: true, noData: true, normal: false, error: false, recovering: false } },
    };

    expect(filterAlerts(noErrorOrNormalStateOptions, alerts).length).toBe(1);
  });

  it('Filters by alert instance label', () => {
    const options = {
      ...defaultOption,
      ...{ alertInstanceLabelFilter: '{severity=low}' },
    };
    const result = filterAlerts(options, alerts);

    expect(result.length).toBe(1);
  });

  it('Filters by alert instance state and label', () => {
    const options = {
      ...defaultOption,
      ...{
        stateFilter: { firing: false, pending: false, noData: false, normal: false, error: true, recovering: false },
      },
      ...{ alertInstanceLabelFilter: '{severity=low}' },
    };
    const result = filterAlerts(options, alerts);

    expect(result.length).toBe(1);
  });
});

describe('getStatDisplayValue', () => {
  const theme = createTheme();
  const thresholds = {
    mode: ThresholdsMode.Absolute as const,
    steps: [
      { value: -Infinity, color: 'green' },
      { value: 3, color: 'orange' },
      { value: 10, color: 'red' },
    ],
  };

  it('returns the count as text with no color when colorMode is None', () => {
    const result = getStatDisplayValue(5, BigValueColorMode.None, thresholds, [], theme);
    expect(result.text).toBe('5');
    expect(result.numeric).toBe(5);
    expect(result.color).toBeUndefined();
  });

  it('returns threshold color when colorMode is Value', () => {
    const result = getStatDisplayValue(5, BigValueColorMode.Value, thresholds, [], theme);
    expect(result.text).toBe('5');
    expect(result.color).toBeDefined();
  });

  it('returns green for count below first threshold step', () => {
    const result = getStatDisplayValue(0, BigValueColorMode.Value, thresholds, [], theme);
    expect(result.color).toBeDefined();
  });

  it('returns last threshold color for large counts', () => {
    const result = getStatDisplayValue(999, BigValueColorMode.Value, thresholds, [], theme);
    expect(result.color).toBeDefined();
  });

  it('applies value mappings to display text', () => {
    const mappings = [
      {
        type: MappingType.ValueToText as const,
        options: {
          '0': { text: 'All Clear', color: 'green' },
        },
      },
    ];
    const result = getStatDisplayValue(0, BigValueColorMode.Value, thresholds, mappings, theme);
    expect(result.text).toBe('All Clear');
  });

  it('applies range mapping for matching count', () => {
    const mappings = [
      {
        type: MappingType.RangeToText as const,
        options: {
          from: 1,
          to: 100,
          result: { text: 'Active Alerts', color: 'yellow' },
        },
      },
    ];
    const result = getStatDisplayValue(5, BigValueColorMode.Value, thresholds, mappings, theme);
    expect(result.text).toBe('Active Alerts');
  });

  it('falls back to count when no mapping matches', () => {
    const mappings = [
      {
        type: MappingType.ValueToText as const,
        options: {
          '99': { text: 'Special' },
        },
      },
    ];
    const result = getStatDisplayValue(5, BigValueColorMode.Value, thresholds, mappings, theme);
    expect(result.text).toBe('5');
  });

  it('handles empty thresholds gracefully', () => {
    const emptyThresholds = { mode: ThresholdsMode.Absolute as const, steps: [] };
    const result = getStatDisplayValue(5, BigValueColorMode.Value, emptyThresholds, [], theme);
    expect(result.text).toBe('5');
    expect(result.numeric).toBe(5);
    expect(result.color).toBeDefined();
  });
});

describe('buildAlertingListUrl', () => {
  it('returns a bare alerting list URL when no filters are active', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: '',
      datasource: '',
      stateFilter: {
        firing: false,
        pending: false,
        noData: false,
        normal: false,
        error: false,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('/alerting/list');
  });

  it('includes rule filter for alert name', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: 'cpu-high',
      datasource: '',
      stateFilter: {
        firing: false,
        pending: false,
        noData: false,
        normal: false,
        error: false,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('rule');
    expect(url).toContain('cpu-high');
  });

  it('includes datasource filter', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: '',
      datasource: 'prometheus',
      stateFilter: {
        firing: false,
        pending: false,
        noData: false,
        normal: false,
        error: false,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('datasource');
    expect(url).toContain('prometheus');
  });

  it('includes state filters for firing and pending', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: '',
      datasource: '',
      stateFilter: {
        firing: true,
        pending: true,
        noData: false,
        normal: false,
        error: false,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('state');
    expect(url).toContain('firing');
    expect(url).toContain('pending');
  });

  it('includes recovering state in the query', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: '',
      datasource: '',
      stateFilter: {
        firing: false,
        pending: false,
        noData: false,
        normal: false,
        error: false,
        recovering: true,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('recovering');
  });

  it('includes namespace filter when folder is selected', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: '',
      datasource: '',
      folder: { uid: 'folder-1', title: 'Operations' },
      stateFilter: {
        firing: false,
        pending: false,
        noData: false,
        normal: false,
        error: false,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('namespace');
    expect(url).toContain('Operations');
  });

  it('includes label filter when alert instance label filter is set', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: '',
      datasource: '',
      alertInstanceLabelFilter: '{severity="critical"}',
      stateFilter: {
        firing: false,
        pending: false,
        noData: false,
        normal: false,
        error: false,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('label');
    expect(url).toContain('severity');
  });

  it('includes dashboard filter when dashboardAlerts is enabled', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      dashboardAlerts: true,
      alertName: '',
      datasource: '',
      stateFilter: {
        firing: false,
        pending: false,
        noData: false,
        normal: false,
        error: false,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options, 'dashboard-uid');
    expect(url).toContain('dashboard');
    expect(url).toContain('dashboard-uid');
  });

  it('combines multiple filters in a single search query', () => {
    const options: UnifiedAlertListOptions = {
      ...defaultOption,
      alertName: 'my-alert',
      datasource: 'grafana',
      stateFilter: {
        firing: true,
        pending: false,
        noData: false,
        normal: false,
        error: true,
        recovering: false,
      },
    };
    const url = buildAlertingListUrl(options);
    expect(url).toContain('rule');
    expect(url).toContain('my-alert');
    expect(url).toContain('datasource');
    expect(url).toContain('firing');
    expect(url).toContain('error');
  });
});
