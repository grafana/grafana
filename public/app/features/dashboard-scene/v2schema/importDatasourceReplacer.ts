import { AnnotationQueryKind, Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

export interface SelectedDatasource {
  uid: string;
  type: string;
  name?: string;
}

/** Maps datasource type (e.g. "prometheus", "loki") to user-selected datasource from the import form */
export type DatasourceMappings = Record<string, SelectedDatasource>;

export function isVariableRef(dsName: string | undefined): boolean {
  return dsName?.startsWith('$') ?? false;
}

export function replaceDatasourcesInDashboard(
  dashboard: DashboardV2Spec,
  mappings: DatasourceMappings
): DashboardV2Spec {
  return {
    ...dashboard,
    annotations: replaceAnnotationDatasources(dashboard.annotations, mappings),
    variables: replaceVariableDatasources(dashboard.variables, mappings),
    elements: replaceElementDatasources(dashboard.elements, mappings),
  };
}

function replaceAnnotationDatasources(
  annotations: DashboardV2Spec['annotations'],
  mappings: DatasourceMappings
): DashboardV2Spec['annotations'] {
  return annotations?.map((annotation: AnnotationQueryKind) => {
    const dsType = annotation.spec.query?.group;
    const currentDsName = annotation.spec.query?.datasource?.name;
    const ds = dsType ? mappings[dsType] : undefined;

    if (isVariableRef(currentDsName) || !dsType || !ds) {
      return annotation;
    }

    return {
      ...annotation,
      spec: {
        ...annotation.spec,
        query: {
          ...annotation.spec.query,
          datasource: { name: ds.uid },
        },
      },
    };
  });
}

function replaceVariableDatasources(
  variables: DashboardV2Spec['variables'],
  mappings: DatasourceMappings
): DashboardV2Spec['variables'] {
  return variables?.map((variable) => {
    if (variable.kind === 'QueryVariable') {
      const dsType = variable.spec.query?.group;
      const currentDsName = variable.spec.query?.datasource?.name;
      const ds = dsType ? mappings[dsType] : undefined;

      if (isVariableRef(currentDsName) || !dsType || !ds) {
        return variable;
      }

      return {
        ...variable,
        spec: {
          ...variable.spec,
          query: {
            ...variable.spec.query,
            datasource: { name: ds.uid },
          },
          options: [],
          current: { text: '', value: '' },
          refresh: 'onDashboardLoad' as const,
        },
      };
    }

    if (variable.kind === 'DatasourceVariable') {
      const dsType = variable.spec.pluginId;
      const ds = dsType ? mappings[dsType] : undefined;

      if (!dsType || !ds) {
        return variable;
      }

      return {
        ...variable,
        spec: {
          ...variable.spec,
          current: {
            text: ds.name ?? ds.uid,
            value: ds.uid,
          },
        },
      };
    }

    if (variable.kind === 'AdhocVariable' || variable.kind === 'GroupByVariable') {
      const dsType = variable.group;
      const currentDsName = variable.datasource?.name;
      const ds = dsType ? mappings[dsType] : undefined;

      if (isVariableRef(currentDsName) || !dsType || !ds) {
        return variable;
      }

      return {
        ...variable,
        datasource: { name: ds.uid },
      };
    }

    return variable;
  });
}

function replaceElementDatasources(
  elements: DashboardV2Spec['elements'],
  mappings: DatasourceMappings
): DashboardV2Spec['elements'] {
  return Object.fromEntries(
    Object.entries(elements).map(([key, element]) => {
      if (element.kind === 'Panel') {
        const panel = { ...element.spec };
        if (panel.data?.kind === 'QueryGroup') {
          const newQueries = panel.data.spec.queries.map((query) => {
            if (query.kind !== 'PanelQuery') {
              return query;
            }

            const queryType = query.spec.query?.group;
            const currentDsName = query.spec.query?.datasource?.name;
            const ds = queryType ? mappings[queryType] : undefined;

            if (isVariableRef(currentDsName) || !queryType || !ds) {
              return query;
            }

            return {
              ...query,
              spec: {
                ...query.spec,
                query: {
                  ...query.spec.query,
                  datasource: { name: ds.uid },
                },
              },
            };
          });
          panel.data = {
            ...panel.data,
            spec: {
              ...panel.data.spec,
              queries: newQueries,
            },
          };
        }
        return [key, { kind: element.kind, spec: panel }];
      }
      return [key, element];
    })
  );
}
