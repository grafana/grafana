import {
  Spec as DashboardV2Spec,
  defaultSpec,
  defaultPanelSpec,
  defaultDataQueryKind,
  defaultPanelQuerySpec,
  defaultVizConfigKind,
  defaultQueryGroupSpec,
  defaultQueryVariableSpec,
  defaultDatasourceVariableSpec,
  defaultAdhocVariableSpec,
  defaultGroupByVariableSpec,
  defaultAnnotationQuerySpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

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
  const baseDashboard = defaultSpec();

  const mappings: DatasourceMappings = {
    loki: { uid: 'new-loki-uid', type: 'loki', name: 'New Loki' },
    prometheus: { uid: 'new-prom-uid', type: 'prometheus', name: 'New Prometheus' },
  };

  const createPanelWithQuery = (group: string, datasourceName: string) => ({
    kind: 'Panel' as const,
    spec: {
      ...defaultPanelSpec(),
      vizConfig: { ...defaultVizConfigKind(), kind: 'VizConfig' as const },
      data: {
        kind: 'QueryGroup' as const,
        spec: {
          ...defaultQueryGroupSpec(),
          queries: [
            {
              kind: 'PanelQuery' as const,
              spec: {
                ...defaultPanelQuerySpec(),
                query: {
                  ...defaultDataQueryKind(),
                  kind: 'DataQuery' as const,
                  group,
                  datasource: { name: datasourceName },
                },
              },
            },
          ],
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
        ...defaultAnnotationQuerySpec(),
        name: 'Test Annotation',
        query: { ...defaultDataQueryKind(), kind: 'DataQuery' as const, group, datasource: { name: datasourceName } },
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
        ...defaultQueryVariableSpec(),
        name: 'test_var',
        query: { ...defaultDataQueryKind(), kind: 'DataQuery' as const, group, datasource: { name: datasourceName } },
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
      expect(variable?.spec.options).toEqual([]);
    });
  });

  describe('datasource variable', () => {
    const createDatasourceVariable = (pluginId: string, currentValue: string, currentText: string) => ({
      kind: 'DatasourceVariable' as const,
      spec: {
        ...defaultDatasourceVariableSpec(),
        name: 'ds',
        pluginId,
        current: { text: currentText, value: currentValue },
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

  describe.each([
    {
      variableType: 'AdhocVariable',
      createVariable: (group: string, datasourceName: string) => ({
        kind: 'AdhocVariable' as const,
        group,
        datasource: { name: datasourceName },
        spec: { ...defaultAdhocVariableSpec(), name: 'Filters' },
      }),
      getVariable: getAdhocVariable,
    },
    {
      variableType: 'GroupByVariable',
      createVariable: (group: string, datasourceName: string) => ({
        kind: 'GroupByVariable' as const,
        group,
        datasource: { name: datasourceName },
        spec: { ...defaultGroupByVariableSpec(), name: 'groupby' },
      }),
      getVariable: getGroupByVariable,
    },
  ])('$variableType', ({ createVariable, getVariable }) => {
    it.each([
      { inputDs: 'old-prom-uid', expectedDs: 'new-prom-uid', desc: 'replaces hardcoded datasource' },
      { inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves variable reference' },
    ])('$desc', ({ inputDs, expectedDs }) => {
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createVariable('prometheus', inputDs)],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getVariable(result);

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
