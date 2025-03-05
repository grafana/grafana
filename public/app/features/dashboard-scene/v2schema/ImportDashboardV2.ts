import {
  AnnotationQueryKind,
  DashboardV2Spec,
  DatasourceVariableKind,
  LibraryPanelSpec,
  PanelQueryKind,
  PanelSpec,
  QueryVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { config } from 'app/core/config';
import { addLibraryPanel, getLibraryPanel } from 'app/features/library-panels/state/api';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

export async function processImportedDashboard(dashboard: DashboardV2Spec) {
  console.log('Processing imported dashboard');
  for (const element of Object.values(dashboard.elements)) {
    if (element.kind === 'Panel') {
      await processPanel(element.spec);
    } else if (element.kind === 'LibraryPanel') {
      await processLibraryPanel(element.spec);
    }
  }

  dashboard.variables.forEach((variable) => {
    if (variable.kind === 'QueryVariable' || variable.kind === 'DatasourceVariable') {
      processVariables(variable);
    }
  });
}

export function processPanel(panel: PanelSpec) {
  // check if the type exists in the registry
  const panelType = config.panels[panel.vizConfig.kind];

  if (!panelType) {
    throw new Error(`Panel type ${panel.vizConfig.kind} not found`);
  }

  panel.data.spec.queries.forEach((query) => {
    resolveDatasource(query.spec);
  });

  return panel;
}

export async function processLibraryPanel(panel: LibraryPanelSpec) {
  const libPanel = await getLibraryPanel(panel.libraryPanel.uid, true);

  if (libPanel === undefined) {
    const newLibPanel = await addLibraryPanel(panel.model, '');
    panel.libraryPanel.uid = newLibPanel.uid;
    panel.libraryPanel.name = newLibPanel.name;
  }

  return panel;
}

export async function resolveDatasource(
  querySpec: AnnotationQueryKind['spec'] | QueryVariableKind['spec'] | PanelQueryKind['spec']
) {
  const datasource = querySpec.datasource || querySpec.query?.kind;
  // use datasourceSrv to get datasource by uid
  // TODO: with Ryan's implementation, get should also return the first of the same type if it doesn't find an exact match by uid
  const resolvedDS = await getDatasourceSrv().get(datasource);

  const type = resolvedDS.type;

  if (resolvedDS !== undefined) {
    querySpec.datasource = {
      type,
      uid: resolvedDS.uid,
    };

    // doing this check because AnnotationQuerySpec's query field is optional
    if (querySpec.query) {
      querySpec.query.kind = type;
    }
  }

  return;
}

export async function processVariables(variable: QueryVariableKind | DatasourceVariableKind) {
  if (variable.kind === 'QueryVariable') {
    await resolveDatasource(variable.spec);
    variable.spec.options = [];
    variable.spec.current = {
      text: '',
      value: '',
    };
    variable.spec.refresh = 'onDashboardLoad';
  } else if (variable.kind === 'DatasourceVariable') {
    variable.spec.current = {
      text: '',
      value: '',
    };
  }
}
