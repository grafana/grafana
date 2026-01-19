import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariableKind, PanelQueryKind, AnnotationQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { getLibraryPanel } from '../../library-panels/state/api';
import { LibraryElementDTO, LibraryElementKind } from '../../library-panels/types';
import {
  DashboardInput,
  DashboardInputs,
  DataSourceInput,
  InputType,
  LibraryPanelInput,
  LibraryPanelInputState,
} from '../state/reducers';

import { isV2Spec } from './detect';

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

      const inputModel: DashboardInput | DataSourceInput = {
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
  const elements = dashboard.__elements;
  if (isRecord(elements)) {
    const libraryPanelInputs = await processLibraryPanelInputs(elements);
    inputs.libraryPanels = libraryPanelInputs;
  }

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

  if (!isV2Spec(dashboard)) {
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
      const annot = annotation as AnnotationQueryKind;
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

async function processLibraryPanelInputs(elements: Record<string, unknown>): Promise<LibraryPanelInput[]> {
  const libraryPanelInputs: LibraryPanelInput[] = [];

  for (const element of Object.values(elements)) {
    if (!isRecord(element) || !isLibraryElementDTO(element)) {
      continue;
    }

    const elementModel = element;

    try {
      const existingPanel = await getLibraryPanel(elementModel.uid, true);

      if (existingPanel.version === elementModel.version) {
        libraryPanelInputs.push({
          model: elementModel,
          state: LibraryPanelInputState.Exists,
        });
      } else {
        libraryPanelInputs.push({
          model: elementModel,
          state: LibraryPanelInputState.Different,
        });
      }
    } catch {
      // Panel doesn't exist, mark as new
      libraryPanelInputs.push({
        model: elementModel,
        state: LibraryPanelInputState.New,
      });
    }
  }

  return libraryPanelInputs;
}

function getDataSourceDescription(input: Record<string, unknown>): string {
  const pluginId = String(input.pluginId ?? '');
  const dsInfo = getDataSourceSrv().getList({ pluginId });

  if (dsInfo.length === 0) {
    return `No data sources of type ${pluginId} found`;
  }

  return `Select a ${pluginId} data source`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLibraryElementDTO(element: Record<string, unknown>): element is LibraryElementDTO {
  return (
    element.kind === LibraryElementKind.Panel && typeof element.uid === 'string' && typeof element.version === 'number'
  );
}
