import { type ResourceStats } from '@grafana/api-clients/rtkq/folder/v1beta1';

import { getParsedCounts } from './utils';

describe('getParsedCounts', () => {
  it('prefers non-zero non-fallback counts, otherwise uses a non-zero sql-fallback (and normalizes legacy resource names)', () => {
    let counts: ResourceStats[] = [
      { group: 'folder.grafana.app', resource: 'folders', count: 0 },
      { group: 'dashboard.grafana.app', resource: 'dashboards', count: 0 },
      { group: 'dashboard.grafana.app', resource: 'librarypanels', count: 0 },
      { group: 'rules.alerting.grafana.app', resource: 'alertrules', count: 0 },
      { group: 'sql-fallback', resource: 'alertrules', count: 1 },
      { group: 'sql-fallback', resource: 'library_elements', count: 1 },
    ];

    expect(getParsedCounts(counts)).toEqual({
      folders: 0,
      dashboards: 0,
      // also normalizes the library_elements to librarypanels
      librarypanels: 1,
      alertrules: 1,
    });

    counts = [
      { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      { group: 'dashboard.grafana.app', resource: 'dashboards', count: 0 },
      { group: 'dashboard.grafana.app', resource: 'librarypanels', count: 2 },
      { group: 'rules.alerting.grafana.app', resource: 'alertrules', count: 2 },
      { group: 'sql-fallback', resource: 'alertrules', count: 1 },
      // we ignore this altogether in this case
      { group: 'sql-fallback', resource: 'library_elements', count: 4 },
    ];

    expect(getParsedCounts(counts)).toEqual({
      folders: 2,
      dashboards: 0,
      librarypanels: 2,
      alertrules: 2,
    });

    expect(
      getParsedCounts([
        { group: 'sql-fallback', resource: 'library_elements', count: 3 }, // FB first
        { group: 'dashboard.grafana.app', resource: 'librarypanels', count: 0 }, // NF second
      ])
    ).toEqual({
      librarypanels: 3,
    });
  });

  it('passes recording rule counts through unchanged', () => {
    const counts: ResourceStats[] = [
      { group: 'rules.alerting.grafana.app', resource: 'alertrules', count: 2 },
      { group: 'rules.alerting.grafana.app', resource: 'recordingrules', count: 5 },
    ];

    expect(getParsedCounts(counts)).toEqual({
      alertrules: 2,
      recordingrules: 5,
    });
  });
  // Alert rules and recording rules are stored in the same database table. The
  // sql-fallback group used to report that whole table as "alertrules", so a folder
  // holding only recording rules had them counted once under alertrules and again
  // under recordingrules, and the alerting tab showed twice the real number. The
  // backend now reports the two kinds separately; these cases pin that the counts
  // the alerting tab adds up stay correct for each mix of rules.
  describe('alert rules and recording rules together', () => {
    const alertingTabCount = (counts: ResourceStats[]) => {
      const parsed = getParsedCounts(counts);
      return (parsed.alertrules ?? 0) + (parsed.recordingrules ?? 0);
    };

    it('counts a folder holding only recording rules once', () => {
      expect(
        alertingTabCount([
          { group: 'rules.alerting.grafana.app', resource: 'alertrules', count: 0 },
          { group: 'rules.alerting.grafana.app', resource: 'recordingrules', count: 22 },
          { group: 'sql-fallback', resource: 'alertrules', count: 0 },
          { group: 'sql-fallback', resource: 'recordingrules', count: 22 },
        ])
      ).toBe(22);
    });

    it('counts recording rules that only the fallback knows about', () => {
      // what comes back when the search index holds no alerting data at all
      expect(
        alertingTabCount([
          { group: 'rules.alerting.grafana.app', resource: 'alertrules', count: 0 },
          { group: 'rules.alerting.grafana.app', resource: 'recordingrules', count: 0 },
          { group: 'sql-fallback', resource: 'alertrules', count: 0 },
          { group: 'sql-fallback', resource: 'recordingrules', count: 1 },
        ])
      ).toBe(1);
    });

    it('adds up a folder holding both kinds', () => {
      expect(
        alertingTabCount([
          { group: 'rules.alerting.grafana.app', resource: 'alertrules', count: 5 },
          { group: 'rules.alerting.grafana.app', resource: 'recordingrules', count: 22 },
          { group: 'sql-fallback', resource: 'alertrules', count: 5 },
          { group: 'sql-fallback', resource: 'recordingrules', count: 22 },
        ])
      ).toBe(27);
    });

    it('counts a folder holding only alert rules once', () => {
      expect(
        alertingTabCount([
          { group: 'rules.alerting.grafana.app', resource: 'alertrules', count: 5 },
          { group: 'rules.alerting.grafana.app', resource: 'recordingrules', count: 0 },
          { group: 'sql-fallback', resource: 'alertrules', count: 5 },
          { group: 'sql-fallback', resource: 'recordingrules', count: 0 },
        ])
      ).toBe(5);
    });
  });
});
