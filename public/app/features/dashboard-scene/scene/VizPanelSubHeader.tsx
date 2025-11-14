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
import { DataSourceRef } from '@grafana/schema/dist/esm/index.gen';

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

  const datasourceRef = queryRunner.state.datasource;
  const queries = data.data?.request?.targets ?? [];
  const adhocFiltersVariable = sceneGraph
    .getVariables(model)
    .state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
  const groupByVariable = sceneGraph
    .getVariables(model)
    .state.variables.find((variable) => variable instanceof GroupByVariable);

  if (
    !datasourceRef ||
    !enableNonApplicableDrilldowns ||
    !supportsDrilldownsApplicability(datasourceRef, adhocFiltersVariable, groupByVariable)
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
  panelDsRef: DataSourceRef,
  filtersVar?: AdHocFiltersVariable,
  groupByVar?: GroupByVariable
) {
  if (
    filtersVar &&
    filtersVar.isApplicabilityEnabled() &&
    panelDsRef.uid === filtersVar.state.datasource?.uid &&
    panelDsRef.type === filtersVar.state.datasource?.type
  ) {
    return true;
  }

  if (
    groupByVar &&
    groupByVar.isApplicabilityEnabled() &&
    panelDsRef.uid === groupByVar.state.datasource?.uid &&
    panelDsRef.type === groupByVar.state.datasource?.type
  ) {
    return true;
  }

  return false;
}
