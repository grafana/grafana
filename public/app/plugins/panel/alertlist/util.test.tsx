import { mockAlertWithState as withState } from 'app/features/alerting/unified/mocks';
import { Alert } from 'app/types/unified-alerting';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { GroupMode, SortOrder, UnifiedAlertListOptions, ViewMode } from './types';
import { filterAlerts } from './util';

const defaultOption: UnifiedAlertListOptions = {
  maxItems: 2,
  sortOrder: SortOrder.AlphaAsc,
  dashboardAlerts: true,
  groupMode: GroupMode.Default,
  groupBy: [''],
  alertName: 'test',
  showInstances: false,
  folder: { id: 1, title: 'test folder' },
  stateFilter: { firing: true, pending: true, normal: true, error: true, critical: false, warn: false, noData: false },
  alertInstanceLabelFilter: '',
  datasource: 'Alertmanager',
  viewMode: ViewMode.List,
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
      ...{
        stateFilter: {
          firing: true,
          pending: true,
          normal: false,
          error: true,
          critical: false,
          warn: false,
          noData: false,
        },
      },
    };

    expect(filterAlerts(noNormalStateOptions, alerts).length).toBe(3);

    const noErrorOrNormalStateOptions = {
      ...defaultOption,
      ...{
        stateFilter: {
          firing: true,
          pending: true,
          normal: false,
          error: false,
          critical: false,
          warn: false,
          noData: false,
        },
      },
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
        stateFilter: {
          firing: false,
          pending: false,
          normal: false,
          error: true,
          critical: false,
          warn: false,
          noData: false,
        },
      },
      ...{ alertInstanceLabelFilter: '{severity=low}' },
    };
    const result = filterAlerts(options, alerts);

    expect(result.length).toBe(1);
  });
});
