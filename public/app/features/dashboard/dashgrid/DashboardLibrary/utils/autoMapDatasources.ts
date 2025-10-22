import { getDataSourceSrv } from '@grafana/runtime';
import { Input } from 'app/features/dashboard/components/DashExportModal/DashboardExporter';
import { DashboardInput, DataSourceInput, InputType } from 'app/features/manage-dashboards/state/reducers';

export interface InputMapping {
  name: string;
  type: 'datasource' | 'constant';
  pluginId?: string;
  value: string;
}

/**
 * Type guard to check if an Input is a DataSourceInput.
 * DataSourceInput requires both type='datasource' and a pluginId property.
 */
export function isDataSourceInput(input: Input): input is Input & DataSourceInput {
  return input.type === 'datasource' && 'pluginId' in input;
}

export interface AutoMapResult {
  allMapped: boolean;
  mappings: InputMapping[];
  unmappedInputs: DataSourceInput[];
}

/**
 * Attempts to automatically map datasource inputs to available datasources.
 * Uses two ways of mapping:
 * 1. Prefer the current datasource if it matches the required type
 * 2. Auto-select if only one compatible datasource exists
 *
 * @param inputs - Array of datasource inputs from dashboard __inputs
 * @param currentDatasourceUid - UID of the datasource selected in "build dashboard" flow
 * @returns Result containing mappings, unmapped inputs, and whether all inputs were mapped
 */
export function tryAutoMapDatasources(inputs: DataSourceInput[], currentDatasourceUid: string): AutoMapResult {
  const mappings: InputMapping[] = [];
  const unmappedInputs: DataSourceInput[] = [];

  for (const input of inputs) {
    // Get all datasources compatible with this input's plugin type
    const compatibleDs = getDataSourceSrv()
      .getList({ type: input.pluginId })
      .filter((ds) => ds.uid);

    let selectedDs: string | undefined;

    // Option 1: Use current datasource if compatible
    if (compatibleDs.some((ds) => ds.uid === currentDatasourceUid)) {
      selectedDs = currentDatasourceUid;
    }
    // Option 2: Auto-select if only one option exists AND it's not the current datasource's type
    // (example: only auto-select if we are confident it's the right choice)
    else if (compatibleDs.length === 1) {
      const currentDs = getDataSourceSrv().getInstanceSettings(currentDatasourceUid);

      // Only auto-select if:
      // - The single option matches the input's plugin type exactly
      // - OR we're coming from a datasource of the same type (e.g., Prometheus -> Prometheus)
      if (currentDs && currentDs.type === input.pluginId) {
        selectedDs = compatibleDs[0].uid;
      }
    }

    if (selectedDs) {
      mappings.push({
        name: input.name,
        type: 'datasource',
        pluginId: input.pluginId,
        value: selectedDs,
      });
    } else {
      unmappedInputs.push(input);
    }
  }

  return {
    allMapped: unmappedInputs.length === 0,
    mappings,
    unmappedInputs,
  };
}

/**
 * Parses constant inputs from dashboard __inputs array.
 * Constants need to be shown to the user for filling that information (the same as the import flow).
 *
 * @param allInputs - All inputs from dashboard.__inputs
 * @returns Array of constant inputs with their default values
 */
export function parseConstantInputs(allInputs: Input[]): DashboardInput[] {
  if (!allInputs || !Array.isArray(allInputs)) {
    return [];
  }

  return allInputs
    .filter((input) => input.type === 'constant')
    .map((input) => ({
      name: input.name,
      label: input.label || input.name,
      description: input.description,
      info: input.description || 'Specify a string constant',
      value: input.value || '',
      type: InputType.Constant,
      pluginId: undefined,
    }));
}

/**
 * Converts constant inputs to InputMapping format for the interpolate API.
 * Uses user-provided values or defaults from the dashboard.
 *
 * @param constantInputs - Array of constant inputs
 * @param userValues - User-entered values (key: input name, value: user input)
 * @returns Array of InputMapping for constants
 */
export function mapConstantInputs(
  constantInputs: DashboardInput[],
  userValues: Record<string, string>
): InputMapping[] {
  return constantInputs.map((input) => ({
    name: input.name,
    type: 'constant',
    value: userValues[input.name] !== undefined ? userValues[input.name] : input.value,
  }));
}
