import type { DataSourceInstanceSettings, VariableModel } from '@grafana/data/types';
import { getDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { type AnnotationQuery, type Dashboard, type Panel, type RowPanel } from '@grafana/schema';
import { type AnnotationQueryKind, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isRecord } from 'app/core/utils/isRecord';
import { ExportFormat } from 'app/features/dashboard/api/types';
import { isDashboardV1Resource, isDashboardV2Resource, isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { ExportLabel } from 'app/features/dashboard-scene/scene/export/exporters';

import { type LibraryElementExport } from '../../../dashboard/components/DashExportModal/DashboardExporter';
import { getLibraryPanel } from '../../../library-panels/state/api';
import { LibraryElementKind } from '../../../library-panels/types';
import {
  type DashboardInput,
  type DashboardInputs,
  type DashboardJson,
  type DataSourceInput,
  type ImportDashboardDTO,
  type ImportFormDataV2,
  InputType,
  type LibraryPanelInput,
  LibraryPanelInputState,
} from '../../types';

/**
 * Remove export-only metadata keys (__inputs, __elements, __requires)
 * that should not be persisted when saving the dashboard.
 */
export function stripExportMetadata(dashboard: Dashboard): Dashboard {
  const json = JSON.parse(JSON.stringify(dashboard));
  delete json.__inputs;
  delete json.__elements;
  delete json.__requires;
  return json;
}

/** Maps datasource type (e.g. "prometheus", "loki") to user-selected datasource from the import form */
export type DatasourceMappings = Record<string, { uid: string; type: string; name?: string }>;

/**
 * Detect the dashboard format from input.
 * Handles k8s resources (v1/v2), raw specs, and classic dashboards.
 */
export function detectExportFormat(input: unknown): ExportFormat {
  if (isDashboardV2Resource(input) || isDashboardV2Spec(input)) {
    return ExportFormat.V2Resource;
  }

  if (isDashboardV1Resource(input)) {
    return ExportFormat.V1Resource;
  }

  return ExportFormat.Classic;
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

function getExportLabel(labels?: { [ExportLabel]?: string }): string | undefined {
  if (!labels) {
    return undefined;
  }

  return labels[ExportLabel];
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
        // Expression datasources do not need user input
        if (inputModel.pluginId !== ExpressionDatasourceRef.type) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (inputModel as DataSourceInput).description = getDataSourceDescription(input);
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          inputs.dataSources.push(inputModel as DataSourceInput);
        }
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
export async function extractV2Inputs(dashboard: unknown): Promise<DashboardInputs> {
  const inputs: DashboardInputs = {
    dataSources: [],
    constants: [],
    libraryPanels: [],
  };

  if (!isDashboardV2Spec(dashboard)) {
    return inputs;
  }

  if (dashboard.variables) {
    for (const variable of dashboard.variables) {
      if (variable.kind === 'ConstantVariable') {
        inputs.constants.push({
          name: variable.spec.name,
          label: variable.spec.label || variable.spec.name,
          info: variable.spec.description || 'Specify a string constant',
          value: variable.spec.query,
          type: InputType.Constant,
        });
      }
    }
  }

  const dsTypes: { [label: string]: string } = {};

  if (dashboard.variables) {
    for (const variable of dashboard.variables) {
      if (variable.kind === 'QueryVariable') {
        const dsType = variable.spec.query?.group;
        const exportLabel = getExportLabel(variable.spec.query.labels);
        if (dsType && exportLabel) {
          dsTypes[exportLabel] = dsType;
        }
      } else if (variable.kind === 'AdhocVariable' || variable.kind === 'GroupByVariable') {
        const dsType = variable.group;
        const exportLabel = getExportLabel(variable.labels);
        if (dsType && exportLabel) {
          dsTypes[exportLabel] = dsType;
        }
      }
    }
  }

  if (dashboard.annotations) {
    for (const annotation of dashboard.annotations) {
      // Skip built-in annotations
      if (annotation.spec.builtIn) {
        continue;
      }

      const dsType = annotation.spec.query?.group;
      const exportLabel = getExportLabel(annotation.spec.query.labels);
      if (dsType && exportLabel) {
        dsTypes[exportLabel] = dsType;
      }
    }
  }

  if (dashboard.elements) {
    for (const element of Object.values(dashboard.elements)) {
      if (element.kind === 'Panel' && element.spec.data?.kind === 'QueryGroup') {
        for (const query of element.spec.data.spec.queries) {
          if (query.kind === 'PanelQuery') {
            const dsType = query.spec.query?.group;
            const exportLabel = getExportLabel(query.spec.query.labels);
            if (dsType && exportLabel) {
              dsTypes[exportLabel] = dsType;
            }
          }
        }
      }
    }
  }

  for (const [label, dsType] of Object.entries(dsTypes)) {
    try {
      const datasource = await getDataSourceSrv().get({ type: dsType });
      if (datasource.meta?.builtIn) {
        continue;
      }
    } catch {
      // datasource not found, still add it as an input so the user can pick one
    }

    const dsInfo = getDataSourceSrv().getList({ pluginId: dsType });
    inputs.dataSources.push({
      name: label,
      label: label,
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
 * Input mapping shape used by the community dashboard / suggested dashboards flow.
 * Matches the format previously sent to POST /api/dashboards/interpolate.
 */
export interface InterpolateInputMapping {
  name: string;
  type: 'datasource' | 'constant';
  pluginId?: string;
  value: string;
}

/**
 * Interpolate a v1 dashboard in the frontend using applyV1Inputs, replacing the
 * backend POST /api/dashboards/interpolate round-trip.
 *
 * Converts InputMapping[] (the format used by the community/suggested dashboard flow)
 * into the shape that applyV1Inputs expects and applies the substitution.
 */
export function interpolateV1Dashboard(
  dashboard: DashboardJson,
  inputMappings: InterpolateInputMapping[]
): DashboardJson {
  const rawInputs = dashboard.__inputs;
  const dsInputs: DataSourceInput[] = (rawInputs ?? [])
    .filter((input) => input.type === 'datasource' && 'pluginId' in input && typeof input.pluginId === 'string')
    .map((input) => ({
      name: String(input.name ?? ''),
      label: String(input.label ?? ''),
      info: String(input.description ?? ''),
      value: String(input.value ?? ''),
      type: InputType.DataSource,
      pluginId: String('pluginId' in input ? input.pluginId : ''),
    }));
  const constantRawInputs = (rawInputs ?? []).filter((input) => input.type === 'constant');

  const wildcardMapping = inputMappings.find((m) => m.name === '*' && m.type === 'datasource');
  const effectiveMappings = wildcardMapping
    ? dsInputs.map((input) => ({
        name: input.name,
        type: 'datasource' as const,
        pluginId: input.pluginId,
        value: wildcardMapping.value,
      }))
    : inputMappings;

  const formDataSources: DataSourceInstanceSettings[] = [];
  const seenPluginIds = new Set<string>();
  for (const mapping of effectiveMappings.filter((m) => m.type === 'datasource')) {
    const dsInput = dsInputs.find((i) => i.name === mapping.name);
    const pluginId = mapping.pluginId ?? dsInput?.pluginId;
    if (!pluginId || seenPluginIds.has(pluginId)) {
      continue;
    }

    // Expression datasources are always forced to __expr__ regardless of user input,
    // matching the backend behavior:
    //   if inputDefJson.Get("pluginId").MustString() == expr.DatasourceType {
    //       input = &dashboardimport.ImportDashboardInput{Value: expr.DatasourceType}
    //   }
    if (pluginId === ExpressionDatasourceRef.type) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      formDataSources.push({
        uid: ExpressionDatasourceRef.uid,
        type: ExpressionDatasourceRef.type,
        name: ExpressionDatasourceRef.name,
      } as DataSourceInstanceSettings);
      seenPluginIds.add(pluginId);
      continue;
    }

    const settings = getDataSourceSrv().getInstanceSettings(mapping.value);
    if (!settings) {
      throw new Error(
        `Dashboard import failed: datasource input "${mapping.name}" references UID "${mapping.value}" which was not found`
      );
    }
    formDataSources.push(settings);
    seenPluginIds.add(pluginId);
  }
  // Ensure expression datasources are included even when not explicitly mapped
  for (const dsInput of dsInputs) {
    if (dsInput.pluginId === ExpressionDatasourceRef.type && !seenPluginIds.has(ExpressionDatasourceRef.type)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      formDataSources.push({
        uid: ExpressionDatasourceRef.uid,
        type: ExpressionDatasourceRef.type,
        name: ExpressionDatasourceRef.name,
      } as DataSourceInstanceSettings);
      seenPluginIds.add(ExpressionDatasourceRef.type);
    }
  }

  const constants: DashboardInput[] = constantRawInputs.map((input) => ({
    name: String(input.name ?? ''),
    label: String(input.label ?? ''),
    info: String(input.description ?? 'Specify a string constant'),
    value: String(input.value ?? ''),
    type: InputType.Constant,
  }));
  const formConstants: string[] = constants.map((c) => {
    const mapping = effectiveMappings.find((m) => m.type === 'constant' && m.name === c.name);
    return mapping ? mapping.value : c.value;
  });

  const form: ImportDashboardDTO = {
    title: dashboard.title ?? '',
    uid: dashboard.uid ?? '',
    gnetId: '',
    constants: formConstants,
    dataSources: formDataSources,
    elements: [],
    folder: { uid: '' },
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const result = applyV1Inputs(dashboard as unknown as Dashboard, { dataSources: dsInputs, constants }, form);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const interpolated = { ...result } as DashboardJson;
  delete interpolated.__inputs;
  delete interpolated.__elements;
  delete interpolated.__requires;
  return interpolated;
}

/**
 * Apply user's datasource selections to a v1 dashboard
 */
export function applyV1Inputs(
  dashboard: Dashboard,
  inputs: { dataSources: DataSourceInput[]; constants?: DashboardInput[] },
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
 * Apply user's datasource selections to a v2 dashboard.
 * Builds mappings from the form and delegates to replaceDatasourcesInDashboard.
 */
export function applyV2Inputs(dashboard: DashboardV2Spec, form: ImportFormDataV2): DashboardV2Spec {
  const mappings: DatasourceMappings = {};
  for (const key of Object.keys(form)) {
    if (key.startsWith('datasource-')) {
      const label = key.replace('datasource-', '');
      const ds = form[key];
      if (isRecord(ds) && typeof ds.uid === 'string' && typeof ds.type === 'string') {
        const name = typeof ds.name === 'string' ? ds.name : undefined;
        mappings[label] = { uid: ds.uid, type: ds.type, name };
      }
    }
  }

  const variables = dashboard.variables?.map((variable) => {
    if (variable.kind !== 'ConstantVariable') {
      return variable;
    }

    const formKey = `constant-${variable.spec.name}`;
    const userValue = form[formKey];
    if (typeof userValue !== 'string') {
      return variable;
    }

    return {
      ...variable,
      spec: {
        ...variable.spec,
        query: userValue,
        current: { text: userValue, value: userValue },
      },
    };
  });

  return replaceDatasourcesInDashboard({ ...dashboard, variables }, mappings);
}

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
    const dsLabel = getExportLabel(annotation.spec.query.labels);
    const currentDsName = annotation.spec.query?.datasource?.name;
    const ds = dsLabel ? mappings[dsLabel] : dsType ? mappings[dsType] : undefined;

    if (isVariableRef(currentDsName) || !dsType || !ds) {
      return annotation;
    }

    // remove export label
    if (annotation.spec.query?.labels) {
      delete annotation.spec.query.labels[ExportLabel];
    }

    return {
      ...annotation,
      spec: {
        ...annotation.spec,
        query: {
          ...annotation.spec.query,
          datasource: { name: ds.uid },
          ...(Object.keys(annotation.spec.query?.labels ?? {}).length > 0 && { labels: annotation.spec.query.labels }),
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
      const dsLabel = getExportLabel(variable.spec.query.labels);
      const currentDsName = variable.spec.query?.datasource?.name;
      const ds = dsLabel ? mappings[dsLabel] : dsType ? mappings[dsType] : undefined;

      if (isVariableRef(currentDsName) || !dsType || !ds) {
        return variable;
      }

      // remove export label
      if (variable.spec.query?.labels) {
        delete variable.spec.query.labels[ExportLabel];
      }

      return {
        ...variable,
        spec: {
          ...variable.spec,
          query: {
            ...variable.spec.query,
            datasource: { name: ds.uid },
            ...(Object.keys(variable.spec.query?.labels ?? {}).length > 0 && { labels: variable.spec.query.labels }),
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
      const dsLabel = getExportLabel(variable.labels);
      const currentDsName = variable.datasource?.name;
      const ds = dsLabel ? mappings[dsLabel] : dsType ? mappings[dsType] : undefined;

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
            const queryLabel = getExportLabel(query.spec.query.labels);
            const currentDsName = query.spec.query?.datasource?.name;
            const ds = queryLabel ? mappings[queryLabel] : queryType ? mappings[queryType] : undefined;

            if (isVariableRef(currentDsName) || !queryType || !ds) {
              return query;
            }

            // remove export label
            if (query.spec.query?.labels) {
              delete query.spec.query.labels[ExportLabel];
            }

            return {
              ...query,
              spec: {
                ...query.spec,
                query: {
                  ...query.spec.query,
                  datasource: { name: ds.uid },
                  ...(Object.keys(query.spec.query?.labels ?? {}).length > 0 && { labels: query.spec.query.labels }),
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

/**
 * Replace ${DS_...} placeholders in a library panel model's datasource references
 * using the user-selected datasources from the import form.
 */
export function interpolateLibraryPanelDatasources(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  inputs: { dataSources: DataSourceInput[] },
  form: ImportDashboardDTO
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const result = { ...model };

  const resolvedDs = resolveDatasource(result.datasource, inputs.dataSources, form.dataSources);
  if (resolvedDs) {
    result.datasource = resolvedDs;
  }

  if (Array.isArray(result.targets)) {
    result.targets = result.targets.map((target: Record<string, unknown>) => {
      const resolved = resolveDatasource(target.datasource, inputs.dataSources, form.dataSources);
      return resolved ? { ...target, datasource: resolved } : target;
    });
  }

  return result;
}

/**
 * Extract a ${DS_...} placeholder string from a datasource reference.
 * Handles both the object form { uid: "${DS_...}" } and legacy string form "${DS_...}".
 */
function extractDatasourcePlaceholder(datasource: unknown): string | undefined {
  if (typeof datasource === 'string' && datasource.startsWith('$')) {
    return datasource;
  }
  if (isRecord(datasource) && typeof datasource.uid === 'string' && datasource.uid.startsWith('$')) {
    return datasource.uid;
  }
  return undefined;
}

/**
 * Resolve a datasource placeholder to the user-selected datasource.
 */
function resolveDatasource(
  datasource: unknown,
  datasourceInputs: DataSourceInput[],
  userDsInputs: DataSourceInstanceSettings[]
): { uid: string; type: string } | undefined {
  const placeholder = extractDatasourcePlaceholder(datasource);
  if (!placeholder) {
    return undefined;
  }
  const userInput = checkUserInputMatch(placeholder, datasourceInputs, userDsInputs);
  if (!userInput) {
    return undefined;
  }
  return { uid: userInput.uid, type: userInput.type };
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
  const resolved = resolveDatasource(annotation.datasource, inputs.dataSources, form.dataSources);
  if (resolved) {
    return { ...annotation, datasource: resolved };
  }
  return annotation;
}

function processPanel(
  panel: Panel | RowPanel,
  inputs: { dataSources: DataSourceInput[] },
  form: ImportDashboardDTO
): Panel | RowPanel {
  const resolvedPanelDs = resolveDatasource(panel.datasource, inputs.dataSources, form.dataSources);

  return {
    ...panel,
    ...(resolvedPanelDs && { datasource: resolvedPanelDs }),
    ...('panels' in panel && {
      panels: panel.panels.map((nestedPanel) => processPanel(nestedPanel, inputs, form)),
    }),
    ...('targets' in panel &&
      panel.targets && {
        targets: panel.targets.map((target) => {
          const resolved = resolveDatasource(target.datasource, inputs.dataSources, form.dataSources);
          return resolved ? { ...target, datasource: resolved } : target;
        }),
      }),
  };
}

function processVariable(
  variable: VariableModel,
  inputs: { dataSources: DataSourceInput[]; constants?: DashboardInput[] },
  form: ImportDashboardDTO
) {
  const variableType = variable.type;

  if (variableType === 'constant' && 'query' in variable && typeof variable.query === 'string' && inputs.constants) {
    for (let i = 0; i < inputs.constants.length; i++) {
      const placeholder = '${' + inputs.constants[i].name + '}';
      if (variable.query === placeholder) {
        const resolved = form.constants[i] ?? inputs.constants[i].value;
        const current = 'current' in variable && isRecord(variable.current) ? variable.current : {};
        const option =
          'options' in variable && Array.isArray(variable.options) && isRecord(variable.options[0])
            ? variable.options[0]
            : {};

        return {
          ...variable,
          query: resolved,
          current: { ...current, text: resolved, value: resolved },
          options: [{ ...option, text: resolved, value: resolved }],
        };
      }
    }
  }

  if (variableType === 'query' && 'datasource' in variable) {
    const resolved = resolveDatasource(variable.datasource, inputs.dataSources, form.dataSources);
    if (resolved) {
      return { ...variable, datasource: resolved };
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
