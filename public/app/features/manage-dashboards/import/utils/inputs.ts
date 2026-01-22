import { DataSourceInstanceSettings, VariableModel } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Panel } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import {
  AnnotationQueryKind,
  AnnotationQueryKind as AnnotationQueryKindV2,
  PanelQueryKind,
  PanelSpec,
  QueryVariableKind,
  Spec as DashboardV2Spec,
  VariableKind,
  defaultDataQueryKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { AnnotationQuery, Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { isRecord } from 'app/core/utils/isRecord';
import { DashboardFormat } from 'app/features/dashboard/api/types';
import { isDashboardV1Resource, isDashboardV2Resource, isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { LibraryElementExport } from '../../../dashboard/components/DashExportModal/DashboardExporter';
import { getLibraryPanel } from '../../../library-panels/state/api';
import { LibraryElementKind } from '../../../library-panels/types';
import {
  DashboardInputs,
  DatasourceSelection,
  DataSourceInput,
  ImportDashboardDTO,
  ImportFormDataV2,
  InputType,
  LibraryPanelInput,
  LibraryPanelInputState,
} from '../../types';

/**
 * Detect the dashboard format from input.
 * Handles k8s resources (v1/v2), raw specs, and classic dashboards.
 */
export function detectDashboardFormat(input: unknown): DashboardFormat {
  if (isDashboardV2Resource(input) || isDashboardV2Spec(input)) {
    return DashboardFormat.V2Resource;
  }

  if (isDashboardV1Resource(input)) {
    return DashboardFormat.V1Resource;
  }

  return DashboardFormat.Classic;
}

function isLibraryElementExport(value: unknown): value is LibraryElementExport {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.uid === 'string' &&
    typeof value.kind === 'number' &&
    isRecord(value.model)
  );
}

function hasUid(query: Record<string, unknown> | {}): query is { uid: string } {
  return 'uid' in query && typeof query['uid'] === 'string';
}

/**
 * Extract library panel inputs from dashboard __elements
 */
export async function getLibraryPanelInputs(dashboardJson?: {
  __elements?: Record<string, unknown>;
}): Promise<LibraryPanelInput[]> {
  if (!dashboardJson || !dashboardJson.__elements) {
    return [];
  }

  const libraryPanelInputs: LibraryPanelInput[] = [];

  for (const element of Object.values(dashboardJson.__elements)) {
    if (!isLibraryElementExport(element)) {
      continue;
    }

    if (element.kind !== LibraryElementKind.Panel) {
      continue;
    }

    const model = element.model;
    const { type, description } = model;
    const { uid, name } = element;
    const input: LibraryPanelInput = {
      model: {
        model,
        uid,
        name,
        version: 0,
        type,
        description,
      },
      state: LibraryPanelInputState.New,
    };

    try {
      const panelInDb = await getLibraryPanel(uid, true);
      input.state = LibraryPanelInputState.Exists;
      input.model = panelInDb;
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'status' in e && e.status !== 404) {
        throw e;
      }
    }

    libraryPanelInputs.push(input);
  }

  return libraryPanelInputs;
}

/**
 * Extract inputs from a v1/classic dashboard JSON
 */
export async function extractV1Inputs(dashboard: unknown): Promise<DashboardInputs> {
  const inputs: DashboardInputs = {
    dataSources: [],
    constants: [],
    libraryPanels: [],
  };

  if (!isRecord(dashboard)) {
    return inputs;
  }

  const dashboardInputs = dashboard.__inputs;
  if (Array.isArray(dashboardInputs)) {
    for (const input of dashboardInputs) {
      if (!isRecord(input)) {
        continue;
      }

      const inputModel = {
        name: String(input.name ?? ''),
        label: String(input.label ?? ''),
        info: String(input.description ?? ''),
        value: String(input.value ?? ''),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        type: input.type as InputType,
        ...(input.type === InputType.DataSource ? { pluginId: String(input.pluginId ?? '') } : {}),
      };

      if (input.type === InputType.DataSource) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (inputModel as DataSourceInput).description = getDataSourceDescription(input);
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        inputs.dataSources.push(inputModel as DataSourceInput);
      } else if (input.type === InputType.Constant) {
        if (!inputModel.info) {
          inputModel.info = 'Specify a string constant';
        }
        inputs.constants.push(inputModel);
      }
    }
  }

  const elements = isRecord(dashboard) && isRecord(dashboard.__elements) ? dashboard.__elements : undefined;
  inputs.libraryPanels = await getLibraryPanelInputs(elements ? { __elements: elements } : undefined);

  return inputs;
}

/**
 * Extract inputs from a v2 dashboard spec
 */
export function extractV2Inputs(dashboard: unknown): DashboardInputs {
  const inputs: DashboardInputs = {
    dataSources: [],
    constants: [],
    libraryPanels: [],
  };

  if (!isDashboardV2Spec(dashboard)) {
    return inputs;
  }

  const dsTypes = new Set<string>();

  if (dashboard.variables) {
    for (const variable of dashboard.variables) {
      if (variable.kind === 'QueryVariable') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const queryVar = variable as QueryVariableKind;
        const dsType = queryVar.spec.query?.spec.group;
        if (dsType) {
          dsTypes.add(dsType);
        }
      }
    }
  }

  if (dashboard.annotations) {
    for (const annotation of dashboard.annotations) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const annot = annotation as AnnotationQueryKindV2;
      const dsType = annot.spec.query?.spec.group;
      if (dsType) {
        dsTypes.add(dsType);
      }
    }
  }

  if (dashboard.elements) {
    for (const element of Object.values(dashboard.elements)) {
      if (element.kind === 'Panel' && element.spec.data?.kind === 'QueryGroup') {
        for (const query of element.spec.data.spec.queries) {
          if (query.kind === 'PanelQuery') {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const panelQuery = query as PanelQueryKind;
            const dsType = panelQuery.spec.query?.kind;
            if (dsType) {
              dsTypes.add(dsType);
            }
          }
        }
      }
    }
  }

  for (const dsType of dsTypes) {
    const dsInfo = getDataSourceSrv().getList({ pluginId: dsType });
    inputs.dataSources.push({
      name: dsType,
      label: dsType,
      info: dsInfo.length > 0 ? `Select a ${dsType} data source` : `No ${dsType} data sources found`,
      description: `${dsType} data source`,
      value: '',
      type: InputType.DataSource,
      pluginId: dsType,
    });
  }

  return inputs;
}

function getDataSourceDescription(input: Record<string, unknown>): string {
  const pluginId = String(input.pluginId ?? '');
  const dsInfo = getDataSourceSrv().getList({ pluginId });

  if (dsInfo.length === 0) {
    return `No data sources of type ${pluginId} found`;
  }

  return `Select a ${pluginId} data source`;
}

/**
 * Apply user's datasource selections to a v1 dashboard
 */
export function applyV1Inputs(
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

/**
 * Apply user's datasource selections to a v2 dashboard
 */
export function applyV2Inputs(dashboard: DashboardV2Spec, form: ImportFormDataV2): DashboardV2Spec {
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
