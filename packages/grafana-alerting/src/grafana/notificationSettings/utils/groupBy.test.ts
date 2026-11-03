import { DISABLE_GROUPING } from '../constants';

import { getDefaultGroupByLabels, nextGroupBy } from './groupBy';

describe('nextGroupBy', () => {
  it('keeps the required labels first and adds the rest once', () => {
    expect(nextGroupBy(['team', 'alertname', 'team'])).toEqual(['grafana_folder', 'alertname', 'team']);
  });

  it('restores a required label that was removed', () => {
    expect(nextGroupBy(['team'])).toEqual(['grafana_folder', 'alertname', 'team']);
  });

  it('collapses to the disable marker when it was just picked, dropping every other label', () => {
    expect(nextGroupBy(['grafana_folder', 'alertname', 'team', DISABLE_GROUPING], DISABLE_GROUPING)).toEqual([
      DISABLE_GROUPING,
    ]);
  });

  it('drops a stale disable marker once another label is picked', () => {
    expect(nextGroupBy([DISABLE_GROUPING, 'team'], 'team')).toEqual(['grafana_folder', 'alertname', 'team']);
  });

  it('keeps a selection that is only the disable marker, so passing the current value back changes nothing', () => {
    expect(nextGroupBy([DISABLE_GROUPING])).toEqual([DISABLE_GROUPING]);
    expect(nextGroupBy(nextGroupBy([DISABLE_GROUPING]))).toEqual([DISABLE_GROUPING]);
  });

  it('treats an empty selection as the required labels only', () => {
    expect(nextGroupBy([])).toEqual(['grafana_folder', 'alertname']);
  });
});

describe('getDefaultGroupByLabels', () => {
  it('lists the labels every overridden group-by includes', () => {
    expect(getDefaultGroupByLabels()).toEqual(['grafana_folder', 'alertname']);
  });

  it('returns a new array each time, so a caller cannot change what others see', () => {
    getDefaultGroupByLabels().push('team');

    expect(getDefaultGroupByLabels()).toEqual(['grafana_folder', 'alertname']);
    expect(nextGroupBy([])).toEqual(['grafana_folder', 'alertname']);
  });
});
