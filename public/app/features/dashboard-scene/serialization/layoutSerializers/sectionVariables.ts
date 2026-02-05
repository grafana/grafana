import { config, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, GroupByVariable, SceneVariableSet } from '@grafana/scenes';
import {
  defaultAdhocVariableKind,
  defaultGroupByVariableKind,
  AdhocVariableKind,
  GroupByVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { sceneVariablesSetToSchemaV2Variables } from '../sceneVariablesSetToVariables';
import { transformVariableHideToEnumV1 } from '../transformToV1TypesUtils';

import { getDataSourceForQuery } from './utils';

export function serializeSectionVariables(
  variableSet?: SceneVariableSet
): Array<AdhocVariableKind | GroupByVariableKind> | undefined {
  if (!variableSet) {
    return undefined;
  }

  const variables = sceneVariablesSetToSchemaV2Variables(variableSet).filter(
    (variable) =>
      variable.kind === defaultAdhocVariableKind().kind || variable.kind === defaultGroupByVariableKind().kind
  );

  return variables.length > 0 ? variables : undefined;
}

export function createSectionVariables(
  variables?: Array<AdhocVariableKind | GroupByVariableKind>
): SceneVariableSet | undefined {
  if (!variables || variables.length === 0) {
    return undefined;
  }

  const sceneVariables = variables
    .map((variable) => {
      if (variable.kind === defaultAdhocVariableKind().kind) {
        const ds = getDataSourceForQuery(
          {
            type: variable.group,
            uid: variable.datasource?.name,
          },
          variable.group
        );

        const adhocVariableState: AdHocFiltersVariable['state'] = {
          name: variable.spec.name,
          label: variable.spec.label,
          description: variable.spec.description,
          type: 'adhoc',
          skipUrlSync: variable.spec.skipUrlSync,
          hide: transformVariableHideToEnumV1(variable.spec.hide),
          datasource: ds,
          applyMode: 'auto',
          filters: variable.spec.filters ?? [],
          baseFilters: variable.spec.baseFilters ?? [],
          defaultKeys: variable.spec.defaultKeys.length ? variable.spec.defaultKeys : undefined,
          useQueriesAsFilterForOptions: true,
          drilldownRecommendationsEnabled: config.featureToggles.drilldownRecommendations,
          layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
          supportsMultiValueOperators: Boolean(
            getDataSourceSrv().getInstanceSettings({ type: ds?.type })?.meta.multiValueFilterOperators
          ),
          collapsible: config.featureToggles.dashboardAdHocAndGroupByWrapper,
        };
        if (variable.spec.allowCustomValue !== undefined) {
          adhocVariableState.allowCustomValue = variable.spec.allowCustomValue;
        }
        return new AdHocFiltersVariable(adhocVariableState);
      }

      if (config.featureToggles.groupByVariable && variable.kind === defaultGroupByVariableKind().kind) {
        const ds = getDataSourceForQuery(
          {
            type: variable.group,
            uid: variable.datasource?.name,
          },
          variable.group
        );

        return new GroupByVariable({
          name: variable.spec.name,
          label: variable.spec.label,
          description: variable.spec.description,
          datasource: ds,
          value: variable.spec.current?.value || [],
          text: variable.spec.current?.text || [],
          skipUrlSync: variable.spec.skipUrlSync,
          isMulti: variable.spec.multi,
          hide: transformVariableHideToEnumV1(variable.spec.hide),
          wideInput: config.featureToggles.dashboardAdHocAndGroupByWrapper,
          drilldownRecommendationsEnabled: config.featureToggles.drilldownRecommendations,
          // @ts-expect-error
          defaultOptions: variable.options,
        });
      }

      return null;
    })
    .filter((variable): variable is AdHocFiltersVariable | GroupByVariable => Boolean(variable));

  if (sceneVariables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({
    variables: sceneVariables,
  });
}
