// Legacy Redux actions - will be removed when kubernetesDashboards feature is removed
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv, isFetchError } from '@grafana/runtime';
import {
  Spec as DashboardV2Spec,
  QueryVariableKind,
  PanelQueryKind,
  AnnotationQueryKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { browseDashboardsAPI, ImportInputs } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ThunkResult } from 'app/types/store';

import {
  Input,
  InputUsage,
  LibraryElementExport,
  LibraryPanel,
} from '../../../dashboard/components/DashExportModal/DashboardExporter';
import { DataSourceInput, ImportDashboardDTO, InputType, LibraryPanelInputState, DashboardJson } from '../../types';
import { getLibraryPanelInputs } from '../utils/process';

import {
  clearDashboard,
  fetchDashboard,
  fetchFailed,
  ImportDashboardState,
  setGcomDashboard,
  setInputs,
  setJsonDashboard,
  setLibraryPanelInputs,
} from './reducers';

export function fetchGcomDashboard(id: string): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(fetchDashboard());
      const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      await dispatch(processElements(dashboard.json));
      await dispatch(processGcomDashboard(dashboard));
      dispatch(processInputs());
    } catch (error) {
      dispatch(fetchFailed());
      if (isFetchError(error)) {
        dispatch(notifyApp(createErrorNotification(error.data.message || error)));
      }
    }
  };
}

export function importDashboardJson(dashboard: any): ThunkResult<void> {
  return async (dispatch) => {
    await dispatch(processElements(dashboard));
    await dispatch(processJsonDashboard(dashboard));
    dispatch(processInputs());
  };
}

export function importDashboardV2Json(dashboard: DashboardV2Spec): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(setJsonDashboard(dashboard));
    dispatch(processV2Datasources(dashboard));
  };
}

const getNewLibraryPanelsByInput = (input: Input, state: ImportDashboardState): LibraryPanel[] | undefined => {
  return input?.usage?.libraryPanels?.filter((usageLibPanel) =>
    state.inputs.libraryPanels.some(
      (libPanel) => libPanel.state !== LibraryPanelInputState.Exists && libPanel.model.uid === usageLibPanel.uid
    )
  );
};

export function processDashboard(dashboardJson: DashboardJson, state: ImportDashboardState): DashboardJson {
  let inputs = dashboardJson.__inputs;
  if (!!state.inputs.libraryPanels?.length) {
    const filteredUsedInputs: Input[] = [];
    dashboardJson.__inputs?.forEach((input: Input) => {
      if (!input?.usage?.libraryPanels) {
        filteredUsedInputs.push(input);
        return;
      }

      const newLibraryPanels = getNewLibraryPanelsByInput(input, state);
      input.usage = { libraryPanels: newLibraryPanels };

      const isInputBeingUsedByANewLibraryPanel = !!newLibraryPanels?.length;
      if (isInputBeingUsedByANewLibraryPanel) {
        filteredUsedInputs.push(input);
      }
    });
    inputs = filteredUsedInputs;
  }

  return { ...dashboardJson, __inputs: inputs };
}

function processGcomDashboard(dashboard: { json: DashboardJson }): ThunkResult<void> {
  return (dispatch, getState) => {
    const state = getState().importDashboard;
    const dashboardJson = processDashboard(dashboard.json, state);
    dispatch(setGcomDashboard({ ...dashboard, json: dashboardJson }));
  };
}

function processJsonDashboard(dashboardJson: DashboardJson): ThunkResult<void> {
  return (dispatch, getState) => {
    const state = getState().importDashboard;
    const dashboard = processDashboard(dashboardJson, state);
    dispatch(setJsonDashboard(dashboard));
  };
}

function processInputs(): ThunkResult<void> {
  return (dispatch, getState) => {
    const dashboard = getState().importDashboard.dashboard;
    if (dashboard && dashboard.__inputs) {
      const inputs: any[] = [];
      dashboard.__inputs.forEach((input: any) => {
        const inputModel: any = {
          name: input.name,
          label: input.label,
          info: input.description,
          value: input.value,
          type: input.type,
          pluginId: input.pluginId,
          options: [],
        };

        inputModel.description = getDataSourceDescription(input);

        if (input.type === InputType.DataSource) {
          getDataSourceOptions(input, inputModel);
        } else if (!inputModel.info) {
          inputModel.info = 'Specify a string constant';
        }

        inputs.push(inputModel);
      });
      dispatch(setInputs(inputs));
    }
  };
}

function processElements(dashboardJson?: { __elements?: Record<string, LibraryElementExport> }): ThunkResult<void> {
  return async function (dispatch) {
    const libraryPanelInputs = await getLibraryPanelInputs(dashboardJson);
    dispatch(setLibraryPanelInputs(libraryPanelInputs));
  };
}

export function processV2Datasources(dashboard: DashboardV2Spec): ThunkResult<void> {
  return async function (dispatch) {
    const { elements, variables, annotations } = dashboard;
    // get elements from dashboard
    // each element can only be a panel
    let inputs: Record<string, DataSourceInput> = {};
    for (const element of Object.values(elements)) {
      if (element.kind !== 'Panel') {
        throw new Error('Only panels are currenlty supported in v2 dashboards');
      }

      if (element.spec.data.spec.queries.length > 0) {
        for (const query of element.spec.data.spec.queries) {
          inputs = await processV2DatasourceInput(query.spec, inputs);
        }
      }
    }

    for (const variable of variables) {
      if (variable.kind === 'QueryVariable') {
        inputs = await processV2DatasourceInput(variable.spec, inputs);
      }
    }

    for (const annotation of annotations) {
      inputs = await processV2DatasourceInput(annotation.spec, inputs);
    }

    dispatch(setInputs(Object.values(inputs)));
  };
}

export function clearLoadedDashboard(): ThunkResult<void> {
  return (dispatch) => {
    dispatch(clearDashboard());
  };
}

export function importDashboard(importDashboardForm: ImportDashboardDTO): ThunkResult<void> {
  return async (dispatch, getState) => {
    const dashboard = getState().importDashboard.dashboard;
    const inputs = getState().importDashboard.inputs;

    const inputsToPersist: ImportInputs[] = [];
    importDashboardForm.dataSources?.forEach((dataSource: DataSourceInstanceSettings, index: number) => {
      const input = inputs.dataSources[index];
      inputsToPersist.push({
        name: input.name,
        type: input.type,
        pluginId: input.pluginId,
        value: dataSource.uid,
      });
    });

    importDashboardForm.constants?.forEach((constant, index) => {
      const input = inputs.constants[index];

      inputsToPersist.push({
        value: constant,
        name: input.name,
        type: input.type,
      });
    });

    dispatch(
      browseDashboardsAPI.endpoints.importDashboard.initiate({
        // uid: if user changed it, take the new uid from importDashboardForm,
        // else read it from original dashboard
        // by default the uid input is disabled, onSubmit ignores values from disabled inputs
        dashboard: { ...dashboard, title: importDashboardForm.title, uid: importDashboardForm.uid || dashboard.uid },
        overwrite: true,
        inputs: inputsToPersist,
        folderUid: importDashboardForm.folder.uid,
      })
    );
  };
}

const getDataSourceOptions = (input: { pluginId: string; pluginName: string }, inputModel: any) => {
  const sources = getDataSourceSrv().getList({ pluginId: input.pluginId });

  if (sources.length === 0) {
    inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
  } else if (!inputModel.info) {
    inputModel.info = 'Select a ' + input.pluginName + ' data source';
  }
};

const getDataSourceDescription = (input: { usage?: InputUsage }): string | undefined => {
  if (!input.usage) {
    return undefined;
  }

  if (input.usage.libraryPanels) {
    const libPanelNames = input.usage.libraryPanels.reduce(
      (acc: string, libPanel, index) => (index === 0 ? libPanel.name : `${acc}, ${libPanel.name}`),
      ''
    );
    return `List of affected library panels: ${libPanelNames}`;
  }

  return undefined;
};

export async function processV2DatasourceInput(
  spec: PanelQueryKind['spec'] | QueryVariableKind['spec'] | AnnotationQueryKind['spec'],
  inputs: Record<string, DataSourceInput> = {}
) {
  let dataSourceInput: DataSourceInput | undefined;
  const dsType = spec.query.group;

  const datasource = await getDatasourceSrv().get({ type: dsType });

  if (datasource.meta?.builtIn) {
    return inputs;
  }

  if (datasource) {
    dataSourceInput = {
      name: datasource.name,
      label: datasource.name,
      info: `Select a ${datasource.type} data source`,
      value: datasource.uid,
      type: InputType.DataSource,
      pluginId: datasource.meta?.id,
    };
    inputs[datasource.meta?.id] = dataSourceInput;
  } else {
    dataSourceInput = {
      name: dsType,
      label: dsType,
      info: `No data sources of type ${dsType} found`,
      value: '',
      type: InputType.DataSource,
      pluginId: dsType,
    };
    inputs[dsType] = dataSourceInput;
  }
  return inputs;
}
