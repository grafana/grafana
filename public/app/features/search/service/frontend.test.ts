import { dataFrameFromJSON, DataFrameJSON, toDataFrame } from '@grafana/data';

import { dump } from './testData';
import { getFrontendGrafanaSearcher, RawIndexData } from './frontend';

describe('simple search', () => {
  it('should support frontend search', async () => {
    const raw: RawIndexData = {
      dashboard: toDataFrame([
        { Name: 'A name (dash)', Description: 'A descr (dash)' },
        { Name: 'B name (dash)', Description: 'B descr (dash)' },
      ]),
      panel: toDataFrame([
        { Name: 'A name (panels)', Description: 'A descr (panels)' },
        { Name: 'B name (panels)', Description: 'B descr (panels)' },
      ]),
    };

    const searcher = getFrontendGrafanaSearcher(raw);
    let results = await searcher.search('name');
    expect(results.body.fields[1].values.toArray()).toMatchInlineSnapshot(`
      Array [
        "B name (panels)",
        "A name (panels)",
        "B name (dash)",
        "A name (dash)",
      ]
    `);

    results = await searcher.search('B');
    expect(results.body.fields[1].values.toArray()).toMatchInlineSnapshot(`
      Array [
        "B name (dash)",
        "B name (panels)",
      ]
    `);
  });

  it('should work with query results', async () => {
    const data: RawIndexData = {};
    for (const frame of dump.results.A.frames) {
      switch (frame.schema.name) {
        case 'folder':
        case 'folders':
          data.folder = dataFrameFromJSON(frame as DataFrameJSON);
          break;

        case 'dashboards':
        case 'dashboard':
          data.dashboard = dataFrameFromJSON(frame as DataFrameJSON);
          break;

        case 'panels':
        case 'panel':
          data.panel = dataFrameFromJSON(frame as DataFrameJSON);
          break;
      }
    }

    const searcher = getFrontendGrafanaSearcher(data);

    const results = await searcher.search('automation');
    expect(results.body.fields[1].values.toArray()).toMatchInlineSnapshot(`
      Array [
        "Home automation",
        "Panel name with automation",
        "Tides",
        "Gaps & null between every point for series B",
      ]
    `);
  });
});
