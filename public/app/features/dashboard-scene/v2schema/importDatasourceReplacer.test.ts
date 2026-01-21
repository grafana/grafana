import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { isVariableRef, replaceDatasourcesInDashboard, DatasourceMappings } from './importDatasourceReplacer';

describe('isVariableRef', () => {
  it('returns true for ${ds} format', () => {
    expect(isVariableRef('${ds}')).toBe(true);
  });

  it('returns true for $ds format', () => {
    expect(isVariableRef('$ds')).toBe(true);
  });

  it('returns false for hardcoded uid', () => {
    expect(isVariableRef('abc123')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isVariableRef(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isVariableRef('')).toBe(false);
  });
});

describe('replaceDatasourcesInDashboard', () => {
  const baseDashboard: DashboardV2Spec = {
    title: 'Test Dashboard',
    annotations: [],
    variables: [],
    elements: {},
    layout: { kind: 'GridLayout', spec: { items: [] } },
    cursorSync: 'Off',
    liveNow: false,
    editable: true,
    preload: false,
    links: [],
    tags: [],
    timeSettings: {
      timezone: 'utc',
      from: 'now-6h',
      to: 'now',
      autoRefresh: '',
      autoRefreshIntervals: [],
      hideTimepicker: false,
      fiscalYearStartMonth: 0,
    },
  };

  const mappings: DatasourceMappings = {
    loki: { uid: 'new-loki-uid', type: 'loki', name: 'New Loki' },
    prometheus: { uid: 'new-prom-uid', type: 'prometheus', name: 'New Prometheus' },
  };

  describe('panel queries', () => {
    it('replaces hardcoded datasource in panel queries', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: {
          'panel-1': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Test Panel',
              vizConfig: { kind: 'VizConfig', group: 'timeseries', spec: {} },
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
                          group: 'loki',
                          version: 'v0',
                          datasource: { name: 'old-loki-uid' },
                          spec: {},
                        },
                      },
                    },
                  ],
                  queryOptions: {},
                  transformations: [],
                },
              },
            },
          },
        },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const panel = result.elements['panel-1'];
      expect(panel.kind).toBe('Panel');
      if (panel.kind === 'Panel' && panel.spec.data?.kind === 'QueryGroup') {
        expect(panel.spec.data.spec.queries[0].spec.query?.datasource?.name).toBe('new-loki-uid');
      }
    });

    it('preserves variable reference ${ds} in panel queries', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: {
          'panel-1': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Test Panel',
              vizConfig: { kind: 'VizConfig', group: 'timeseries', spec: {} },
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
                          datasource: { name: '${ds}' },
                          spec: {},
                        },
                      },
                    },
                  ],
                  queryOptions: {},
                  transformations: [],
                },
              },
            },
          },
        },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const panel = result.elements['panel-1'];
      if (panel.kind === 'Panel' && panel.spec.data?.kind === 'QueryGroup') {
        expect(panel.spec.data.spec.queries[0].spec.query?.datasource?.name).toBe('${ds}');
      }
    });

    it('preserves variable reference $ds in panel queries', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: {
          'panel-1': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Test Panel',
              vizConfig: { kind: 'VizConfig', group: 'timeseries', spec: {} },
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
                          datasource: { name: '$ds' },
                          spec: {},
                        },
                      },
                    },
                  ],
                  queryOptions: {},
                  transformations: [],
                },
              },
            },
          },
        },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const panel = result.elements['panel-1'];
      if (panel.kind === 'Panel' && panel.spec.data?.kind === 'QueryGroup') {
        expect(panel.spec.data.spec.queries[0].spec.query?.datasource?.name).toBe('$ds');
      }
    });

    it('does not replace when no mapping exists for datasource type', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: {
          'panel-1': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Test Panel',
              vizConfig: { kind: 'VizConfig', group: 'timeseries', spec: {} },
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
                          group: 'elasticsearch',
                          version: 'v0',
                          datasource: { name: 'es-uid' },
                          spec: {},
                        },
                      },
                    },
                  ],
                  queryOptions: {},
                  transformations: [],
                },
              },
            },
          },
        },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const panel = result.elements['panel-1'];
      if (panel.kind === 'Panel' && panel.spec.data?.kind === 'QueryGroup') {
        expect(panel.spec.data.spec.queries[0].spec.query?.datasource?.name).toBe('es-uid');
      }
    });
  });

  describe('annotations', () => {
    it('replaces hardcoded datasource in annotations', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        annotations: [
          {
            kind: 'AnnotationQuery',
            spec: {
              name: 'Test Annotation',
              enable: true,
              hide: false,
              iconColor: 'red',
              query: {
                kind: 'DataQuery',
                group: 'prometheus',
                version: 'v0',
                datasource: { name: 'old-prom-uid' },
                spec: {},
              },
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(result.annotations?.[0].spec.query?.datasource?.name).toBe('new-prom-uid');
    });

    it('preserves variable reference in annotations', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        annotations: [
          {
            kind: 'AnnotationQuery',
            spec: {
              name: 'Test Annotation',
              enable: true,
              hide: false,
              iconColor: 'red',
              query: {
                kind: 'DataQuery',
                group: 'prometheus',
                version: 'v0',
                datasource: { name: '${ds}' },
                spec: {},
              },
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(result.annotations?.[0].spec.query?.datasource?.name).toBe('${ds}');
    });
  });

  describe('QueryVariable', () => {
    it('replaces hardcoded datasource in QueryVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [
          {
            kind: 'QueryVariable',
            spec: {
              name: 'test_var',
              current: { text: 'All', value: '$__all' },
              options: [{ text: 'All', value: '$__all' }],
              hide: 'dontHide',
              skipUrlSync: false,
              multi: false,
              includeAll: true,
              allowCustomValue: false,
              refresh: 'onDashboardLoad',
              regex: '',
              sort: 'disabled',
              query: {
                kind: 'DataQuery',
                group: 'prometheus',
                version: 'v0',
                datasource: { name: 'old-prom-uid' },
                spec: {},
              },
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const variable = result.variables?.[0];
      expect(variable?.kind).toBe('QueryVariable');
      if (variable?.kind === 'QueryVariable') {
        expect(variable.spec.query?.datasource?.name).toBe('new-prom-uid');
        expect(variable.spec.options).toEqual([]);
        expect(variable.spec.current).toEqual({ text: '', value: '' });
        expect(variable.spec.refresh).toBe('onDashboardLoad');
      }
    });

    it('preserves variable reference in QueryVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [
          {
            kind: 'QueryVariable',
            spec: {
              name: 'test_var',
              current: { text: 'All', value: '$__all' },
              options: [{ text: 'All', value: '$__all' }],
              hide: 'dontHide',
              skipUrlSync: false,
              multi: false,
              includeAll: true,
              allowCustomValue: false,
              refresh: 'onDashboardLoad',
              regex: '',
              sort: 'disabled',
              query: {
                kind: 'DataQuery',
                group: 'prometheus',
                version: 'v0',
                datasource: { name: '${ds}' },
                spec: {},
              },
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const variable = result.variables?.[0];
      if (variable?.kind === 'QueryVariable') {
        expect(variable.spec.query?.datasource?.name).toBe('${ds}');
        // Options should NOT be reset when preserving variable
        expect(variable.spec.options).toEqual([{ text: 'All', value: '$__all' }]);
      }
    });
  });

  describe('DatasourceVariable', () => {
    it('replaces current value in DatasourceVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [
          {
            kind: 'DatasourceVariable',
            spec: {
              name: 'ds',
              pluginId: 'prometheus',
              current: { text: 'Old Prometheus', value: 'old-prom-uid' },
              options: [],
              hide: 'dontHide',
              skipUrlSync: false,
              multi: false,
              includeAll: false,
              allowCustomValue: false,
              refresh: 'onDashboardLoad',
              regex: '',
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const variable = result.variables?.[0];
      expect(variable?.kind).toBe('DatasourceVariable');
      if (variable?.kind === 'DatasourceVariable') {
        expect(variable.spec.current?.value).toBe('new-prom-uid');
        expect(variable.spec.current?.text).toBe('New Prometheus');
      }
    });
  });

  describe('AdhocVariable', () => {
    it('replaces hardcoded datasource in AdhocVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [
          {
            kind: 'AdhocVariable',
            group: 'loki',
            datasource: { name: 'old-loki-uid' },
            spec: {
              name: 'Filters',
              hide: 'dontHide',
              skipUrlSync: false,
              allowCustomValue: true,
              defaultKeys: [],
              filters: [],
              baseFilters: [],
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const variable = result.variables?.[0];
      expect(variable?.kind).toBe('AdhocVariable');
      if (variable?.kind === 'AdhocVariable') {
        expect(variable.datasource?.name).toBe('new-loki-uid');
      }
    });

    it('preserves variable reference in AdhocVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [
          {
            kind: 'AdhocVariable',
            group: 'loki',
            datasource: { name: '${ds}' },
            spec: {
              name: 'Filters',
              hide: 'dontHide',
              skipUrlSync: false,
              allowCustomValue: true,
              defaultKeys: [],
              filters: [],
              baseFilters: [],
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const variable = result.variables?.[0];
      if (variable?.kind === 'AdhocVariable') {
        expect(variable.datasource?.name).toBe('${ds}');
      }
    });
  });

  describe('GroupByVariable', () => {
    it('replaces hardcoded datasource in GroupByVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [
          {
            kind: 'GroupByVariable',
            group: 'prometheus',
            datasource: { name: 'old-prom-uid' },
            spec: {
              name: 'groupby',
              hide: 'dontHide',
              skipUrlSync: false,
              allowCustomValue: false,
              options: [],
              current: { text: '', value: '' },
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const variable = result.variables?.[0];
      expect(variable?.kind).toBe('GroupByVariable');
      if (variable?.kind === 'GroupByVariable') {
        expect(variable.datasource?.name).toBe('new-prom-uid');
      }
    });

    it('preserves variable reference in GroupByVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [
          {
            kind: 'GroupByVariable',
            group: 'prometheus',
            datasource: { name: '${ds}' },
            spec: {
              name: 'groupby',
              hide: 'dontHide',
              skipUrlSync: false,
              allowCustomValue: false,
              options: [],
              current: { text: '', value: '' },
            },
          },
        ],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const variable = result.variables?.[0];
      if (variable?.kind === 'GroupByVariable') {
        expect(variable.datasource?.name).toBe('${ds}');
      }
    });
  });

  describe('edge cases', () => {
    it('handles mixed variable and hardcoded datasources', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: {
          'panel-variable': {
            kind: 'Panel',
            spec: {
              id: 1,
              title: 'Variable DS Panel',
              vizConfig: { kind: 'VizConfig', group: 'timeseries', spec: {} },
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
                          datasource: { name: '${ds}' },
                          spec: {},
                        },
                      },
                    },
                  ],
                  queryOptions: {},
                  transformations: [],
                },
              },
            },
          },
          'panel-hardcoded': {
            kind: 'Panel',
            spec: {
              id: 2,
              title: 'Hardcoded DS Panel',
              vizConfig: { kind: 'VizConfig', group: 'logs', spec: {} },
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
                          group: 'loki',
                          version: 'v0',
                          datasource: { name: 'old-loki-uid' },
                          spec: {},
                        },
                      },
                    },
                  ],
                  queryOptions: {},
                  transformations: [],
                },
              },
            },
          },
        },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      const varPanel = result.elements['panel-variable'];
      const hardcodedPanel = result.elements['panel-hardcoded'];

      if (varPanel.kind === 'Panel' && varPanel.spec.data?.kind === 'QueryGroup') {
        expect(varPanel.spec.data.spec.queries[0].spec.query?.datasource?.name).toBe('${ds}');
      }

      if (hardcodedPanel.kind === 'Panel' && hardcodedPanel.spec.data?.kind === 'QueryGroup') {
        expect(hardcodedPanel.spec.data.spec.queries[0].spec.query?.datasource?.name).toBe('new-loki-uid');
      }
    });
  });
});
