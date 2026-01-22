import { getDataSourceSrv } from '@grafana/runtime';
import {
  AnnotationQueryKind as AnnotationQueryKindV2,
  PanelQueryKind,
  QueryVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { isRecord } from 'app/core/utils/isRecord';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { getLibraryPanel } from '../../../library-panels/state/api';
import { LibraryElementDTO, LibraryElementKind } from '../../../library-panels/types';
import { DashboardInputs, DataSourceInput, InputType, LibraryPanelInput, LibraryPanelInputState } from '../types';

interface LibraryElementExport {
  uid: string;
  name: string;
  kind: number;
  model: {
    type: string;
    description?: string;
  };
}

/**
 * Process library panel elements from a dashboard JSON and check their existence state.
 * This is a pure async function shared between k8s and legacy import paths.
 */
export async function getLibraryPanelInputs(dashboardJson?: {
  __elements?: Record<string, LibraryElementExport>;
}): Promise<LibraryPanelInput[]> {
  if (!dashboardJson || !dashboardJson.__elements) {
    return [];
  }

  const libraryPanelInputs: LibraryPanelInput[] = [];

  for (const element of Object.values(dashboardJson.__elements)) {
    if (element.kind !== LibraryElementKind.Panel) {
      continue;
    }

    const model = element.model;
    const { type, description } = model;
    const { uid, name } = element;
    // Creating partial LibraryElementDTO for new panels - will be replaced if panel exists
    const input: LibraryPanelInput = {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      model: {
        model,
        uid,
        name,
        version: 0,
        type,
        kind: LibraryElementKind.Panel,
        description,
      } as LibraryElementDTO,
      state: LibraryPanelInputState.New,
    };

    try {
      const panelInDb = await getLibraryPanel(uid, true);
      input.state = LibraryPanelInputState.Exists;
      input.model = panelInDb;
    } catch (e: unknown) {
      // Check for 404 status indicating panel doesn't exist
      if (typeof e === 'object' && e !== null && 'status' in e && e.status !== 404) {
        throw e;
      }
    }

    libraryPanelInputs.push(input);
  }

  return libraryPanelInputs;
}

/**
 * Process inputs from a v1/classic dashboard JSON
 */
export async function processInputsFromDashboard(dashboard: unknown): Promise<DashboardInputs> {
  const inputs: DashboardInputs = {
    dataSources: [],
    constants: [],
    libraryPanels: [],
  };

  if (!isRecord(dashboard)) {
    return inputs;
  }

  // Process __inputs from dashboard
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

  // Process library panels from __elements
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  inputs.libraryPanels = await getLibraryPanelInputs(dashboard as { __elements?: Record<string, unknown> });

  return inputs;
}

/**
 * Process inputs from a v2 dashboard spec
 */
export function processV2Inputs(dashboard: unknown): DashboardInputs {
  const inputs: DashboardInputs = {
    dataSources: [],
    constants: [],
    libraryPanels: [],
  };

  if (!isDashboardV2Spec(dashboard)) {
    return inputs;
  }

  // dashboard is now typed as DashboardV2Spec thanks to type guard
  const dsTypes = new Set<string>();

  // Collect datasource types from variables
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

  // Collect datasource types from annotations
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

  // Collect datasource types from panel queries
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

  // Create datasource inputs for each unique type
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
