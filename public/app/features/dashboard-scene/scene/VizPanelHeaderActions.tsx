import { useEffect } from 'react';

import {
  GroupByVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
  SceneDataQuery,
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

  public getQueries(): SceneDataQuery[] {
    const panel = this.parent;

    if (!(panel instanceof VizPanel)) {
      return [];
    }

    const dataObject = sceneGraph.getData(panel);

    if (!dataObject) {
      return [];
    }

    const queryRunner = dataObject.state.$data;

    if (!queryRunner || !(queryRunner instanceof SceneQueryRunner)) {
      return [];
    }

    return queryRunner.state.queries;
  }

  public checkGroupByActionRender(): boolean {
    const panel = this.parent;

    if (!(panel instanceof VizPanel)) {
      return false;
    }

    const groupByVariable = sceneGraph
      .getVariables(panel)
      .state.variables.find((variable) => variable instanceof GroupByVariable);

    if (!groupByVariable) {
      return false;
    }

    const dataObject = sceneGraph.getData(panel);

    if (!dataObject) {
      return false;
    }

    const queryRunner = dataObject.state.$data;

    if (!queryRunner || !(queryRunner instanceof SceneQueryRunner)) {
      return false;
    }

    const { datasource } = queryRunner.useState();

    const dsUid = sceneGraph.interpolate(queryRunner, datasource?.uid);
    const groupByAppliedOnPanel = Boolean(
      dsUid === sceneGraph.interpolate(groupByVariable, groupByVariable.state.datasource?.uid) &&
        groupByVariable.isApplicabilityEnabled()
    );

    return !this.state.hideGroupByAction && groupByAppliedOnPanel;
  }
}

export function VizPanelHeaderActionsRenderer({ model }: SceneComponentProps<VizPanelHeaderActions>) {
  const panel = model.parent;

  const queries = model.getQueries();

  const groupByVariable = sceneGraph
    .getVariables(model)
    .state.variables.find((variable) => variable instanceof GroupByVariable);

  const groupByActionRender = model.checkGroupByActionRender();

  useEffect(() => {
    if (!(panel instanceof VizPanel)) {
      return;
    }

    const showMenuAlways = groupByActionRender;
    if (panel.state.showMenuAlways !== showMenuAlways) {
      panel.setState({ showMenuAlways });
    }

    return () => {
      if (panel.state.showMenuAlways) {
        panel.setState({ showMenuAlways: false });
      }
    };
  }, [groupByActionRender, panel]);

  return <>{groupByActionRender && <PanelGroupByAction groupByVariable={groupByVariable!} queries={queries} />}</>;
}
