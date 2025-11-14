import {
  GroupByVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';

import { PanelGroupByAction } from './PanelGroupByAction';

export interface VizPanelHeaderActionsState extends SceneObjectState {
  hideGroupByAction?: boolean;
}

export class VizPanelHeaderActions extends SceneObjectBase<VizPanelHeaderActionsState> {
  static Component = VizPanelHeaderActionsRenderer;

  constructor(state: Partial<VizPanelHeaderActionsState>) {
    super({
      hideGroupByAction: state.hideGroupByAction ?? false,
      ...state,
    });
  }
}

export function VizPanelHeaderActionsRenderer({ model }: SceneComponentProps<VizPanelHeaderActions>) {
  const hideGroupByAction = model.state.hideGroupByAction;
  const panel = model.parent;

  if (!panel || !(panel instanceof VizPanel)) {
    return null;
  }

  const groupByVariable = sceneGraph
    .getVariables(panel)
    .state.variables.find((variable) => variable instanceof GroupByVariable);

  if (!groupByVariable) {
    return null;
  }

  const dataObject = panel ? sceneGraph.getData(panel) : undefined;

  if (!dataObject) {
    return null;
  }

  const queryRunner = dataObject.state.$data;

  if (!queryRunner || !(queryRunner instanceof SceneQueryRunner)) {
    return null;
  }

  const { queries, datasource } = queryRunner.useState();

  const dsUid = sceneGraph.interpolate(queryRunner, datasource?.uid);

  const groupByAppliedOnPanel = Boolean(
    dsUid === sceneGraph.interpolate(groupByVariable, groupByVariable.state.datasource?.uid) &&
      groupByVariable.isApplicabilityEnabled()
  );

  return (
    <>
      {!hideGroupByAction && groupByAppliedOnPanel && (
        <PanelGroupByAction groupByVariable={groupByVariable} queries={queries} />
      )}
    </>
  );
}
