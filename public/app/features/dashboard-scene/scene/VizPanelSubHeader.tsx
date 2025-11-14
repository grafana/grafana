import {
  SceneComponentProps,
  SceneObjectState,
  SceneObjectBase,
  sceneGraph,
  AdHocFiltersVariable,
  GroupByVariable,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';

import { PanelNonApplicableFiltersSubHeader } from './PanelNonApplicableFiltersSubHeader';

export interface VizPanelSubHeaderState extends SceneObjectState {
  enableNonApplicableDrilldowns?: boolean;
}

export class VizPanelSubHeader extends SceneObjectBase<VizPanelSubHeaderState> {
  static Component = VizPanelSubHeaderRenderer;

  constructor(state: Partial<VizPanelSubHeaderState>) {
    super({
      enableNonApplicableDrilldowns: state.enableNonApplicableDrilldowns ?? false,
      ...state,
    });
  }
}

export function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const { enableNonApplicableDrilldowns } = model.useState();

  const panel = model.parent;

  if (!panel || !(panel instanceof VizPanel)) {
    return null;
  }

  const dataObject = panel ? sceneGraph.getData(panel) : undefined;
  const data = dataObject?.useState();

  if (!data) {
    return null;
  }

  const queryRunner = data.$data;

  if (!queryRunner || !(queryRunner instanceof SceneQueryRunner)) {
    return null;
  }

  const dsUid = sceneGraph.interpolate(queryRunner, queryRunner.state.datasource?.uid);
  const queries = data.data?.request?.targets ?? [];
  const adhocFiltersVariable = sceneGraph
    .getVariables(model)
    .state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
  const groupByVariable = sceneGraph
    .getVariables(model)
    .state.variables.find((variable) => variable instanceof GroupByVariable);

  if (
    !dsUid ||
    !enableNonApplicableDrilldowns ||
    !supportsDrilldownsApplicability(dsUid, adhocFiltersVariable, groupByVariable)
  ) {
    return null;
  }

  return (
    <PanelNonApplicableFiltersSubHeader
      filtersVar={adhocFiltersVariable}
      groupByVar={groupByVariable}
      queries={queries}
    />
  );
}

function supportsDrilldownsApplicability(
  dsUid: string,
  filtersVar?: AdHocFiltersVariable,
  groupByVar?: GroupByVariable
) {
  if (
    filtersVar &&
    filtersVar.isApplicabilityEnabled() &&
    dsUid === sceneGraph.interpolate(filtersVar, filtersVar.state.datasource?.uid)
  ) {
    return true;
  }

  if (
    groupByVar &&
    groupByVar.isApplicabilityEnabled() &&
    dsUid === sceneGraph.interpolate(groupByVar, groupByVar.state.datasource?.uid)
  ) {
    return true;
  }

  return false;
}
