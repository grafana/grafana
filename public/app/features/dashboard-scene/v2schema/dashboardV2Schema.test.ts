import { dashboardV2SpecSchema } from './dashboardV2Schema';

function gridLayout(items: unknown[] = []) {
  return { kind: 'GridLayout', spec: { items } };
}

function minimalSpec(overrides: Record<string, unknown> = {}) {
  return { title: 'Test', layout: gridLayout(), timeSettings: {}, ...overrides };
}

describe('dashboardV2SpecSchema', () => {
  it('accepts a minimal spec and fills CUE defaults', () => {
    const result = dashboardV2SpecSchema.safeParse(minimalSpec());
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toMatchObject({
      title: 'Test',
      cursorSync: 'Off',
      editable: true,
      preload: false,
      annotations: [],
      links: [],
      tags: [],
      variables: [],
      elements: {},
    });
    expect(result.data.timeSettings.from).toBe('now-6h');
    expect(result.data.timeSettings.autoRefreshIntervals).toContain('5s');
  });

  it('rejects a spec missing a required field (title)', () => {
    const { title, ...noTitle } = minimalSpec();
    const result = dashboardV2SpecSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid layout kind literal', () => {
    const result = dashboardV2SpecSchema.safeParse(minimalSpec({ layout: { kind: 'NotALayout', spec: {} } }));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid variable enum value', () => {
    const result = dashboardV2SpecSchema.safeParse(
      minimalSpec({
        variables: [
          {
            kind: 'QueryVariable',
            spec: { name: 'v', hide: 'nope', query: { kind: 'DataQuery', group: 'prometheus', spec: {} } },
          },
        ],
      })
    );
    expect(result.success).toBe(false);
  });

  it('preserves arbitrary keys in open fields (query spec, viz options, field config custom)', () => {
    const spec = minimalSpec({
      elements: {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'P',
            description: '',
            links: [],
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [
                  {
                    kind: 'PanelQuery',
                    spec: {
                      refId: 'A',
                      hidden: false,
                      query: {
                        kind: 'DataQuery',
                        group: 'prometheus',
                        version: 'v0',
                        spec: { expr: 'up', customKey: 123 },
                      },
                    },
                  },
                ],
                transformations: [],
                queryOptions: {},
              },
            },
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              spec: {
                options: { foo: 'bar', nested: { a: 1 } },
                fieldConfig: { defaults: { custom: { x: 1 } }, overrides: [] },
              },
            },
          },
        },
      },
    });

    const result = dashboardV2SpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const panel = result.data.elements['panel-1'];
    expect(panel.kind).toBe('Panel');
    if (panel.kind !== 'Panel') {
      return;
    }
    expect(panel.spec.data.spec.queries[0].spec.query.spec).toEqual({ expr: 'up', customKey: 123 });
    expect(panel.spec.vizConfig.spec.options).toEqual({ foo: 'bar', nested: { a: 1 } });
    expect(panel.spec.vizConfig.spec.fieldConfig.defaults).toEqual({ custom: { x: 1 } });
  });

  it('validates a deeply nested recursive layout (rows -> tabs -> grid)', () => {
    const spec = minimalSpec({
      layout: {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Row',
                layout: {
                  kind: 'TabsLayout',
                  spec: {
                    tabs: [{ kind: 'TabsLayoutTab', spec: { title: 'Tab', layout: gridLayout() } }],
                  },
                },
              },
            },
          ],
        },
      },
    });

    expect(dashboardV2SpecSchema.safeParse(spec).success).toBe(true);
  });

  it('tolerates Go-marshaled null arrays (nil slices) and normalizes them to []', () => {
    const result = dashboardV2SpecSchema.safeParse(
      minimalSpec({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exercising the null-array serialization shape
        tags: null as any,
        variables: [
          {
            kind: 'CustomVariable',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exercising the null-array serialization shape
            spec: { name: 'v', query: 'a,b', options: null as any },
          },
        ],
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.tags).toEqual([]);
    const variable = result.data.variables[0];
    expect(variable.kind).toBe('CustomVariable');
    if (variable.kind !== 'CustomVariable') {
      return;
    }
    expect(variable.spec.options).toEqual([]);
  });

  it('normalizes undefined VizConfig options to {} (serializer passes state.options through)', () => {
    const spec = minimalSpec({
      elements: {
        'panel-1': {
          kind: 'Panel',
          spec: {
            id: 1,
            title: 'P',
            description: '',
            links: [],
            data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
            vizConfig: {
              kind: 'VizConfig',
              group: 'timeseries',
              version: '',
              // `options` omitted, mirroring `vizPanel.state.options === undefined`.
              spec: { fieldConfig: { defaults: {}, overrides: [] } },
            },
          },
        },
      },
    });

    const result = dashboardV2SpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const panel = result.data.elements['panel-1'];
    if (panel.kind !== 'Panel') {
      throw new Error('expected Panel');
    }
    expect(panel.spec.vizConfig.spec.options).toEqual({});
  });

  it('defaults the constant DataQuery kind when a query omits it', () => {
    const result = dashboardV2SpecSchema.safeParse(
      minimalSpec({
        variables: [
          {
            kind: 'QueryVariable',
            // query omits `kind: 'DataQuery'`.
            spec: { name: 'v', query: { group: 'prometheus', spec: {} } },
          },
        ],
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const variable = result.data.variables[0];
    if (variable.kind !== 'QueryVariable') {
      throw new Error('expected QueryVariable');
    }
    expect(variable.spec.query.kind).toBe('DataQuery');
  });

  it('defaults the constant AnnotationQuery kind when an annotation omits it', () => {
    const result = dashboardV2SpecSchema.safeParse(
      minimalSpec({
        // annotation omits `kind: 'AnnotationQuery'`.
        annotations: [{ spec: { name: 'a', query: { group: 'prometheus', spec: {} } } }],
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.annotations[0].kind).toBe('AnnotationQuery');
  });

  it('accepts a panel that omits vizConfig.version (runtime-filled metadata)', () => {
    const result = dashboardV2SpecSchema.safeParse(
      minimalSpec({
        elements: {
          'panel-1': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'P',
              description: '',
              links: [],
              // vizConfig intentionally omits `version`.
              vizConfig: {
                kind: 'VizConfig',
                group: 'timeseries',
                spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
              },
              data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
            },
          },
        },
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const panel = result.data.elements['panel-1'];
    if (panel.kind !== 'Panel') {
      throw new Error('expected element panel-1 to be a Panel');
    }
    expect(panel.spec.vizConfig.version).toBe('');
  });

  it('tolerates an invalid variable refresh/sort by falling back to the canonical default', () => {
    const result = dashboardV2SpecSchema.safeParse(
      minimalSpec({
        variables: [
          {
            kind: 'QueryVariable',
            spec: {
              name: 'v',
              refresh: 'bogus',
              sort: 'bogus',
              query: { kind: 'DataQuery', group: 'prometheus', spec: {} },
            },
          },
        ],
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const variable = result.data.variables[0];
    if (variable.kind !== 'QueryVariable') {
      throw new Error('expected QueryVariable');
    }
    expect(variable.spec.refresh).toBe('never');
    expect(variable.spec.sort).toBe('disabled');
  });

  it('tolerates an invalid conditionalRendering visibility by falling back to show', () => {
    const result = dashboardV2SpecSchema.safeParse(
      minimalSpec({
        layout: {
          kind: 'RowsLayout',
          spec: {
            rows: [
              {
                kind: 'RowsLayoutRow',
                spec: {
                  title: 'r',
                  conditionalRendering: {
                    kind: 'ConditionalRenderingGroup',
                    spec: { visibility: 'bogus', condition: 'and', items: [] },
                  },
                  layout: gridLayout(),
                },
              },
            ],
          },
        },
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const layout = result.data.layout;
    if (layout.kind !== 'RowsLayout') {
      throw new Error('expected RowsLayout');
    }
    expect(layout.spec.rows[0].spec.conditionalRendering?.spec.visibility).toBe('show');
  });
});
