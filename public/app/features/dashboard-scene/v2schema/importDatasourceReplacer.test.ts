import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { isVariableRef, replaceDatasourcesInDashboard, DatasourceMappings } from './importDatasourceReplacer';

describe('isVariableRef', () => {
  it.each([
    { input: '${ds}', expected: true },
    { input: '$ds', expected: true },
    { input: 'abc123', expected: false },
    { input: undefined, expected: false },
    { input: '', expected: false },
  ])('returns $expected for $input', ({ input, expected }) => {
    expect(isVariableRef(input)).toBe(expected);
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

  const createPanelWithQuery = (group: string, datasourceName: string) => ({
    kind: 'Panel' as const,
    spec: {
      id: 1,
      title: 'Test Panel',
      description: '',
      links: [],
      vizConfig: {
        kind: 'VizConfig' as const,
        group: 'timeseries',
        version: 'v0',
        spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      },
      data: {
        kind: 'QueryGroup' as const,
        spec: {
          queries: [
            {
              kind: 'PanelQuery' as const,
              spec: {
                refId: 'A',
                hidden: false,
                query: {
                  kind: 'DataQuery' as const,
                  group,
                  version: 'v0',
                  datasource: { name: datasourceName },
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
  });

  const getPanelQueryDatasourceName = (result: DashboardV2Spec, panelKey = 'panel-1') => {
    const panel = result.elements[panelKey];
    if (panel.kind === 'Panel' && panel.spec.data?.kind === 'QueryGroup') {
      return panel.spec.data.spec.queries[0].spec.query?.datasource?.name;
    }
    return undefined;
  };

  const getQueryVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'QueryVariable' ? variable : undefined;
  };

  const getDatasourceVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'DatasourceVariable' ? variable : undefined;
  };

  const getAdhocVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'AdhocVariable' ? variable : undefined;
  };

  const getGroupByVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'GroupByVariable' ? variable : undefined;
  };

  describe('panel queries', () => {
    it.each([
      { group: 'loki', inputDs: 'old-loki-uid', expectedDs: 'new-loki-uid', desc: 'replaces hardcoded datasource' },
      { group: 'prometheus', inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves ${ds} variable reference' },
      { group: 'prometheus', inputDs: '$ds', expectedDs: '$ds', desc: 'preserves $ds variable reference' },
      {
        group: 'elasticsearch',
        inputDs: 'es-uid',
        expectedDs: 'es-uid',
        desc: 'keeps original when no mapping exists',
      },
    ])('$desc', ({ group, inputDs, expectedDs }) => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: { 'panel-1': createPanelWithQuery(group, inputDs) },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(getPanelQueryDatasourceName(result)).toBe(expectedDs);
    });
  });

  describe('annotations', () => {
    const createAnnotation = (group: string, datasourceName: string) => ({
      kind: 'AnnotationQuery' as const,
      spec: {
        name: 'Test Annotation',
        enable: true,
        hide: false,
        iconColor: 'red',
        query: {
          kind: 'DataQuery' as const,
          group,
          version: 'v0',
          datasource: { name: datasourceName },
          spec: {},
        },
      },
    });

    it.each([
      { inputDs: 'old-prom-uid', expectedDs: 'new-prom-uid', desc: 'replaces hardcoded datasource' },
      { inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves variable reference' },
    ])('$desc', ({ inputDs, expectedDs }) => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        annotations: [createAnnotation('prometheus', inputDs)],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(result.annotations?.[0].spec.query?.datasource?.name).toBe(expectedDs);
    });
  });

  describe('query variable', () => {
    const createQueryVariable = (group: string, datasourceName: string) => ({
      kind: 'QueryVariable' as const,
      spec: {
        name: 'test_var',
        current: { text: 'All', value: '$__all' },
        options: [{ text: 'All', value: '$__all' }],
        hide: 'dontHide' as const,
        skipUrlSync: false,
        multi: false,
        includeAll: true,
        allowCustomValue: false,
        refresh: 'onDashboardLoad' as const,
        regex: '',
        sort: 'disabled' as const,
        query: {
          kind: 'DataQuery' as const,
          group,
          version: 'v0',
          datasource: { name: datasourceName },
          spec: {},
        },
      },
    });

    it('replaces hardcoded datasource and resets options/current', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createQueryVariable('prometheus', 'old-prom-uid')],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getQueryVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.spec.query?.datasource?.name).toBe('new-prom-uid');
      expect(variable?.spec.options).toEqual([]);
      expect(variable?.spec.current).toEqual({ text: '', value: '' });
      expect(variable?.spec.refresh).toBe('onDashboardLoad');
    });

    it('preserves variable reference and keeps options intact', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createQueryVariable('prometheus', '${ds}')],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getQueryVariable(result);

      expect(variable?.spec.query?.datasource?.name).toBe('${ds}');
      expect(variable?.spec.options).toEqual([{ text: 'All', value: '$__all' }]);
    });
  });

  describe('datasource varia', () => {
    const createDatasourceVariable = (pluginId: string, currentValue: string, currentText: string) => ({
      kind: 'DatasourceVariable' as const,
      spec: {
        name: 'ds',
        pluginId,
        current: { text: currentText, value: currentValue },
        options: [],
        hide: 'dontHide' as const,
        skipUrlSync: false,
        multi: false,
        includeAll: false,
        allowCustomValue: false,
        refresh: 'onDashboardLoad' as const,
        regex: '',
      },
    });

    it('replaces current value in DatasourceVariable', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createDatasourceVariable('prometheus', 'old-prom-uid', 'Old Prometheus')],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getDatasourceVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.spec.current?.value).toBe('new-prom-uid');
      expect(variable?.spec.current?.text).toBe('New Prometheus');
    });
  });

  describe('AdhocVariable', () => {
    const createAdhocVariable = (group: string, datasourceName: string) => ({
      kind: 'AdhocVariable' as const,
      group,
      datasource: { name: datasourceName },
      spec: {
        name: 'Filters',
        hide: 'dontHide' as const,
        skipUrlSync: false,
        allowCustomValue: true,
        defaultKeys: [],
        filters: [],
        baseFilters: [],
      },
    });

    it.each([
      { inputDs: 'old-loki-uid', expectedDs: 'new-loki-uid', desc: 'replaces hardcoded datasource' },
      { inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves variable reference' },
    ])('$desc', ({ inputDs, expectedDs }) => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createAdhocVariable('loki', inputDs)],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getAdhocVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.datasource?.name).toBe(expectedDs);
    });
  });

  describe('GroupBy variable', () => {
    const createGroupByVariable = (group: string, datasourceName: string) => ({
      kind: 'GroupByVariable' as const,
      group,
      datasource: { name: datasourceName },
      spec: {
        name: 'groupby',
        hide: 'dontHide' as const,
        skipUrlSync: false,
        allowCustomValue: false,
        multi: false,
        options: [],
        current: { text: '', value: '' },
      },
    });

    it.each([
      { inputDs: 'old-prom-uid', expectedDs: 'new-prom-uid', desc: 'replaces hardcoded datasource' },
      { inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves variable reference' },
    ])('$desc', ({ inputDs, expectedDs }) => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createGroupByVariable('prometheus', inputDs)],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getGroupByVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.datasource?.name).toBe(expectedDs);
    });
  });

  describe('edge cases', () => {
    it('handles mixed variable and hardcoded datasources', () => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: {
          'panel-variable': createPanelWithQuery('prometheus', '${ds}'),
          'panel-hardcoded': createPanelWithQuery('loki', 'old-loki-uid'),
        },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(getPanelQueryDatasourceName(result, 'panel-variable')).toBe('${ds}');
      expect(getPanelQueryDatasourceName(result, 'panel-hardcoded')).toBe('new-loki-uid');
    });
  });
});
