import { MutableDataFrame } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { createEmptyQueryResponse } from 'app/features/explore/state/utils';

import { buildPanelElementFromExplore } from './buildPanelElementFromExplore';

const datasource = { type: 'loki', uid: 'loki-1' };

function queryResponseWith(overrides: Partial<ReturnType<typeof createEmptyQueryResponse>> = {}) {
  return { ...createEmptyQueryResponse(), ...overrides };
}

describe('buildPanelElementFromExplore', () => {
  it('carries the queries and datasource into the panel element', () => {
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];

    const element = buildPanelElementFromExplore({ queries, queryResponse: queryResponseWith(), datasource });

    expect(element.kind).toBe('Panel');
    // Narrowed for the panel-only fields below; a LibraryPanel here would mean the builder attached
    // a library behavior, which nothing in Explore does.
    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.data.spec.queries).toHaveLength(2);
    expect(element.spec.data.spec.queries[0].spec.refId).toBe('A');
    expect(element.spec.data.spec.queries[1].spec.hidden).toBe(true);
    expect(element.spec.data.spec.queries[0].spec.query.datasource).toEqual({ name: 'loki-1' });
  });

  // The visualization type comes from Explore's own inference, which is the reason this goes through
  // buildDashboardPanelFromExploreState rather than assembling a VizPanel from pane state.
  it('infers the visualization from the response frames', () => {
    const element = buildPanelElementFromExplore({
      queries: [{ refId: 'A' }],
      queryResponse: queryResponseWith({ graphFrames: [new MutableDataFrame({ refId: 'A', fields: [] })] }),
      datasource,
    });

    expect(element.kind === 'Panel' && element.spec.vizConfig.group).toBe('timeseries');
  });

  it('falls back to a table when no frame type matches', () => {
    const element = buildPanelElementFromExplore({
      queries: [{ refId: 'A' }],
      queryResponse: queryResponseWith(),
      datasource,
    });

    expect(element.kind === 'Panel' && element.spec.vizConfig.group).toBe('table');
  });

  it('carries the logs table column selection across as transformations', () => {
    const element = buildPanelElementFromExplore({
      queries: [{ refId: 'A' }],
      queryResponse: queryResponseWith(),
      datasource,
      panelState: { logs: { displayedFields: ['field1', 'field2'] } },
    });

    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.data.spec.transformations).toEqual([
      {
        kind: 'Transformation',
        group: 'organize',
        spec: {
          options: {
            includeByName: { field1: true, field2: true },
            indexByName: { field1: 0, field2: 1 },
          },
        },
      },
    ]);
  });
});
