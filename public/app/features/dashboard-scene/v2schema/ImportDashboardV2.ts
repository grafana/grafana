import {
  AnnotationQueryKind,
  DashboardV2Spec,
  DatasourceVariableKind,
  PanelQueryKind,
  PanelSpec,
  QueryVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { config } from 'app/core/config';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

export async function processImportedDashboard(dashboard: DashboardV2Spec) {
  for (const element of Object.values(dashboard.elements)) {
    if (element.kind === 'Panel') {
      processPanel(element.spec);
    }
  }

  dashboard.variables.forEach((variable) => {
    if (variable.kind === 'QueryVariable' || variable.kind === 'DatasourceVariable') {
      processVariables(variable);
    }
  });

  return dashboard;
}
function processPanel(panel: PanelSpec) {
  // check if the type exists in the registry
  const panelType = config.panels[panel.vizConfig.kind];

  if (!panelType) {
    throw new Error(`Panel type ${panel.vizConfig.kind} not found`);
  }

  panel.data.spec.queries.forEach(async (query) => {
    await resolveDatasource(query.spec);
  });

  return panel;
}

async function resolveDatasource(
  querySpec: AnnotationQueryKind['spec'] | QueryVariableKind['spec'] | PanelQueryKind['spec']
) {
  const datasource = querySpec.datasource || { type: querySpec.query?.kind };
  // use datasourceSrv to get datasource by uid
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
