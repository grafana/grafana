import { DataSourceInstanceSettings, VariableModel } from '@grafana/data';
import { Panel } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import {
  AnnotationQueryKind,
  PanelSpec,
  Spec as DashboardV2Spec,
  VariableKind,
  defaultDataQueryKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { AnnotationQuery, Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { isRecord } from 'app/core/utils/isRecord';

import { DatasourceSelection, DataSourceInput, ImportDashboardDTO, ImportFormDataV2 } from '../types';

export function applyV1DatasourceInputs(
  dashboard: Dashboard,
  inputs: { dataSources: DataSourceInput[] },
  form: ImportDashboardDTO
): Dashboard {
  const annotations = (dashboard.annotations?.list ?? []).map((annotation: AnnotationQuery) => {
    return processAnnotation(annotation, inputs, form);
  });

  const panels = (dashboard.panels ?? []).map((panel: Panel) => {
    return processPanel(panel, inputs, form);
  });

  const variables = (dashboard.templating?.list ?? []).map((variable: VariableModel) => {
    return processVariable(variable, inputs, form);
  });

  return {
    ...dashboard,
    title: form.title,
    ...(dashboard.annotations ? { annotations: { ...dashboard.annotations, list: annotations } } : {}),
    ...(dashboard.panels ? { panels } : {}),
    templating: {
      ...(dashboard.templating ?? {}),
      list: variables,
    },
    uid: form.uid,
  };
}

export function applyV2DatasourceInputs(dashboard: DashboardV2Spec, form: ImportFormDataV2): DashboardV2Spec {
  const annotations = dashboard.annotations?.map((annotation) => processAnnotationV2(annotation, form));
  const variables = dashboard.variables?.map((variable) => processVariableV2(variable, form));
  const elements = processElementsV2(dashboard.elements, form);

  return {
    ...dashboard,
    annotations,
    variables,
    elements,
  };
}

function getDatasourceSelection(form: ImportFormDataV2, key: string): DatasourceSelection | undefined {
  const value = form[`datasource-${key}`];
  if (!isRecord(value)) {
    return undefined;
  }

  const uid = value.uid;
  const type = value.type;
  if (typeof uid === 'string' && typeof type === 'string') {
    const name = typeof value.name === 'string' ? value.name : undefined;
    return { uid, type, name };
  }

  return undefined;
}

function processAnnotationV2(annotation: AnnotationQueryKind, form: ImportFormDataV2): AnnotationQueryKind {
  const dsType = annotation.spec.query?.spec.group;
  const ds = dsType ? getDatasourceSelection(form, dsType) : undefined;

  if (ds) {
    return {
      ...annotation,
      spec: {
        ...annotation.spec,
        query: {
          kind: 'DataQuery',
          group: dsType,
          version: defaultDataQueryKind().version,
          datasource: { name: ds.uid },
          spec: {
            ...annotation.spec.query?.spec,
          },
        },
      },
    };
  }

  return annotation;
}

function processVariableV2(variable: VariableKind, form: ImportFormDataV2): VariableKind {
  if (variable.kind === 'QueryVariable') {
    const dsType = variable.spec.query?.spec.group;
    const ds = dsType ? getDatasourceSelection(form, dsType) : undefined;

    if (ds) {
      return {
        ...variable,
        spec: {
          ...variable.spec,
          query: {
            ...variable.spec.query,
            spec: {
              ...variable.spec.query.spec,
              group: ds.type,
              datasource: {
                name: ds.uid,
              },
            },
          },
          options: [],
          current: {
            text: '',
            value: '',
          },
          refresh: 'onDashboardLoad' as const,
        },
      };
    }
  }

  if (variable.kind === 'DatasourceVariable') {
    const dsType = variable.spec.pluginId;
    const ds = dsType ? getDatasourceSelection(form, dsType) : undefined;

    if (ds) {
      return {
        ...variable,
        spec: {
          ...variable.spec,
          current: {
            text: ds.name ?? '',
            value: ds.uid,
          },
        },
      };
    }
  }

  return variable;
}

function processElementsV2(elements: DashboardV2Spec['elements'], form: ImportFormDataV2): DashboardV2Spec['elements'] {
  return Object.fromEntries(
    Object.entries(elements).map(([key, element]) => {
      if (element.kind === 'Panel') {
        const processedPanel = processPanelV2(element.spec, form);
        return [key, { kind: element.kind, spec: processedPanel }];
      }
      return [key, element];
    })
  );
}

function processPanelV2(panel: PanelSpec, form: ImportFormDataV2): PanelSpec {
  if (panel.data?.kind !== 'QueryGroup') {
    return panel;
  }

  const newQueries = panel.data.spec.queries.map((query) => {
    if (query.kind === 'PanelQuery') {
      const queryType = query.spec.query?.kind;
      const ds = queryType ? getDatasourceSelection(form, queryType) : undefined;

      if (ds) {
        return {
          ...query,
          spec: {
            ...query.spec,
            datasource: {
              uid: ds.uid,
              type: ds.type,
            },
          },
        };
      }
    }
    return query;
  });

  return {
    ...panel,
    data: {
      ...panel.data,
      spec: {
        ...panel.data.spec,
        queries: newQueries,
      },
    },
  };
}

function hasUid(query: Record<string, unknown> | {}): query is { uid: string } {
  return 'uid' in query && typeof query['uid'] === 'string';
}

function checkUserInputMatch(
  templateizedUid: string,
  datasourceInputs: DataSourceInput[],
  userDsInputs: DataSourceInstanceSettings[]
) {
  const dsName = templateizedUid.replace(/\$\{(.*)\}/, '$1');
  const input = datasourceInputs?.find((ds) => ds.name === dsName);
  const userInput = input && userDsInputs.find((ds) => ds.type === input.pluginId);
  return userInput;
}

function processAnnotation(
  annotation: AnnotationQuery,
  inputs: { dataSources: DataSourceInput[] },
  form: ImportDashboardDTO
): AnnotationQuery {
  if (annotation.datasource && annotation.datasource.uid && annotation.datasource.uid.startsWith('$')) {
    const userInput = checkUserInputMatch(annotation.datasource.uid, inputs.dataSources, form.dataSources);
    if (userInput) {
      return {
        ...annotation,
        datasource: {
          ...annotation.datasource,
          uid: userInput.uid,
        },
      };
    }
  }

  return annotation;
}

function processPanel(panel: Panel, inputs: { dataSources: DataSourceInput[] }, form: ImportDashboardDTO): Panel {
  if (panel.datasource && panel.datasource.uid && panel.datasource.uid.startsWith('$')) {
    const userInput = checkUserInputMatch(panel.datasource.uid, inputs.dataSources, form.dataSources);

    const queries = panel.targets?.map((target) => {
      if (target.datasource && hasUid(target.datasource) && target.datasource.uid.startsWith('$')) {
        const userInput = checkUserInputMatch(target.datasource.uid, inputs.dataSources, form.dataSources);
        if (userInput) {
          return {
            ...target,
            datasource: {
              ...target.datasource,
              uid: userInput.uid,
            },
          };
        }
      }
      return target;
    });

    if (userInput) {
      return {
        ...panel,
        targets: queries,
        datasource: {
          ...panel.datasource,
          uid: userInput.uid,
        },
      };
    }
  }

  return panel;
}

function processVariable(
  variable: VariableModel,
  inputs: { dataSources: DataSourceInput[] },
  form: ImportDashboardDTO
) {
  const variableType = variable.type;
  if (variableType === 'query' && 'datasource' in variable && isRecord(variable.datasource)) {
    const datasourceUid = variable.datasource.uid;
    if (typeof datasourceUid === 'string' && datasourceUid.startsWith('$')) {
      const userInput = checkUserInputMatch(datasourceUid, inputs.dataSources, form.dataSources);
      if (userInput) {
        return {
          ...variable,
          datasource: {
            ...variable.datasource,
            uid: userInput.uid,
          },
        };
      }
    }
  }

  if (variableType === 'datasource' && 'current' in variable && isRecord(variable.current)) {
    const currentValue = variable.current.value;
    if (currentValue && String(currentValue).startsWith('$')) {
      const userInput = checkUserInputMatch(String(currentValue), inputs.dataSources, form.dataSources);
      if (userInput) {
        const selected = typeof variable.current.selected === 'boolean' ? variable.current.selected : undefined;
        return {
          ...variable,
          current: {
            selected,
            text: userInput.name,
            value: userInput.uid,
          },
        };
      }
    }
  }

  return variable;
}
