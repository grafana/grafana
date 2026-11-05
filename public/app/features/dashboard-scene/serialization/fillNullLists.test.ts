import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { fillNullLists } from './fillNullLists';

function nullPaths(value: unknown, path = 'spec'): string[] {
  if (value === null) {
    return [path];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, i) => nullPaths(child, `${path}[${i}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => nullPaths(child, `${path}.${key}`));
  }
  return [];
}

const conditionalRendering = {
  kind: 'ConditionalRenderingGroup',
  spec: { visibility: 'show', condition: 'and', items: null },
};
const annotation = { kind: 'AnnotationQuery', spec: { name: 'a', filter: { exclude: false, ids: null } } };

// A null in every list that fillNullLists fills.
const specWithNullLists = {
  title: 'nulls',
  annotations: [annotation],
  links: [{ title: 'l', type: 'dashboards', tags: null }],
  tags: null,
  timeSettings: { from: 'now-6h', to: 'now' },
  variables: [
    { kind: 'QueryVariable', spec: { name: 'q', options: null } },
    { kind: 'CustomVariable', spec: { name: 'c', options: null } },
    { kind: 'AdhocVariable', spec: { name: 'f', baseFilters: null, filters: null, defaultKeys: null } },
  ],
  elements: {
    p1: {
      kind: 'Panel',
      spec: {
        links: null,
        data: { kind: 'QueryGroup', spec: { queries: null, transformations: null, queryOptions: {} } },
        vizConfig: {
          kind: 'VizConfig',
          spec: {
            options: {},
            fieldConfig: {
              defaults: { thresholds: { mode: 'absolute', steps: null } },
              overrides: [{ matcher: { id: 'byName' }, properties: null }],
            },
          },
        },
      },
    },
  },
  layout: {
    kind: 'TabsLayout',
    spec: {
      tabs: [
        {
          kind: 'TabsLayoutTab',
          spec: {
            conditionalRendering,
            variables: [{ kind: 'GroupByVariable', spec: { name: 'g', options: null } }],
            annotations: null,
            layout: {
              kind: 'RowsLayout',
              spec: {
                rows: [
                  {
                    kind: 'RowsLayoutRow',
                    spec: {
                      conditionalRendering,
                      annotations: null,
                      layout: {
                        kind: 'AutoGridLayout',
                        spec: { items: [{ kind: 'AutoGridLayoutItem', spec: { conditionalRendering } }] },
                      },
                    },
                  },
                  { kind: 'RowsLayoutRow', spec: { layout: { kind: 'GridLayout', spec: { items: null } } } },
                ],
              },
            },
          },
        },
      ],
    },
  },
};

describe('fillNullLists', () => {
  it('replaces every null list with an empty list', () => {
    const spec = structuredClone(specWithNullLists) as unknown as DashboardV2Spec;

    fillNullLists(spec);

    expect(nullPaths(spec)).toEqual([]);
    expect(spec.tags).toEqual([]);
    expect(spec.annotations).toHaveLength(1);
  });

  it('leaves null refresh intervals alone so the default intervals apply', () => {
    const spec = structuredClone(specWithNullLists) as unknown as DashboardV2Spec;
    spec.timeSettings.autoRefreshIntervals = null as unknown as string[];

    fillNullLists(spec);

    expect(spec.timeSettings.autoRefreshIntervals).toBeNull();
  });

  it('replaces null top-level collections', () => {
    const spec = {
      title: 'empty',
      annotations: null,
      links: null,
      variables: null,
      elements: null,
      timeSettings: { from: 'now-6h', to: 'now' },
      layout: { kind: 'RowsLayout', spec: { rows: null } },
    } as unknown as DashboardV2Spec;

    fillNullLists(spec);

    expect(nullPaths(spec)).toEqual([]);
    expect(spec.elements).toEqual({});
  });

  it('skips null annotations and variables on rows and tabs', () => {
    const section = { variables: null, annotations: null, layout: { kind: 'GridLayout', spec: { items: [] } } };
    const spec = {
      title: 'sections',
      timeSettings: { from: 'now-6h', to: 'now' },
      layout: {
        kind: 'TabsLayout',
        spec: {
          tabs: [
            {
              kind: 'TabsLayoutTab',
              spec: {
                ...section,
                layout: { kind: 'RowsLayout', spec: { rows: [{ kind: 'RowsLayoutRow', spec: section }] } },
              },
            },
          ],
        },
      },
    } as unknown as DashboardV2Spec;

    expect(() => fillNullLists(spec)).not.toThrow();
    expect(tab.spec.annotations).toEqual([]);
    expect(section.annotations).toEqual([]);
  });

  it('preserves omitted nested annotations', () => {
    const row = {
      kind: 'RowsLayoutRow',
      spec: { layout: { kind: 'GridLayout', spec: { items: [] } } },
    };
    const tab = {
      kind: 'TabsLayoutTab',
      spec: { layout: { kind: 'RowsLayout', spec: { rows: [row] } } },
    };
    const spec = {
      title: 'omitted annotations',
      timeSettings: { from: 'now-6h', to: 'now' },
      layout: { kind: 'TabsLayout', spec: { tabs: [tab] } },
    } as unknown as DashboardV2Spec;

    fillNullLists(spec);

    expect('annotations' in tab.spec).toBe(false);
    expect('annotations' in row.spec).toBe(false);
  });

  it('fills a panel that has no data or visualization config', () => {
    const spec = {
      title: 'partial',
      timeSettings: { from: 'now-6h', to: 'now' },
      elements: { p1: { kind: 'Panel', spec: { links: null } } },
      layout: { kind: 'GridLayout', spec: { items: [] } },
    } as unknown as DashboardV2Spec;

    fillNullLists(spec);

    expect(nullPaths(spec)).toEqual([]);
  });
});
