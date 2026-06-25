import { type ResourceStats } from '@grafana/api-clients/rtkq/folder/v1beta1';

import { getParsedCounts } from './utils';

describe('getParsedCounts', () => {
  it('prefers the non-fallback entry and keeps the fallback only when no other entry exists', () => {
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
  });
});
