import { useEffect, useMemo } from 'react';

import {
  GroupByVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
  SceneDataState,
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

    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    if (!this.parent || !(this.parent instanceof VizPanel)) {
      throw new Error('VizPanelHeaderActions must be a child of a VizPanel');
    }
  };

  public updatePanelShowAlwaysMenu(showMenuAlways: boolean) {
    const panel = this.parent;

    if (panel instanceof VizPanel && panel.state.showMenuAlways !== showMenuAlways) {
      panel.setState({ showMenuAlways });
    }

    return () => {
      if (panel instanceof VizPanel && panel.state.showMenuAlways) {
        panel.setState({ showMenuAlways: false });
      }
    };
  }

  public getData() {
    const panel = this.parent;
    const dataObject = panel ? sceneGraph.getData(panel) : undefined;
    return dataObject?.useState();
  }

  public getQueryRunner(dataState?: SceneDataState): SceneQueryRunner | null {
    const queryRunner = dataState?.$data;

    if (!queryRunner || !(queryRunner instanceof SceneQueryRunner)) {
      return null;
    }

    return queryRunner;
  }
}

export function VizPanelHeaderActionsRenderer({ model }: SceneComponentProps<VizPanelHeaderActions>) {
  const panel = model.parent!;
  const data = model.getData();
  const queryRunner = model.getQueryRunner(data);
  const datasourceUid = queryRunner?.state.datasource?.uid;

  const queries = data?.data?.request?.targets ?? [];

  const { variables } = sceneGraph.getVariables(model).useState();
  const groupByVariable = useMemo(() => variables.find((variable) => variable instanceof GroupByVariable), [variables]);

  const groupByState = groupByVariable?.useState();

  const groupByActionRender = useMemo(
    () => checkGroupByActionRender(queryRunner, groupByVariable, groupByState?.datasource?.uid, datasourceUid),
    [queryRunner, groupByVariable, groupByState?.datasource?.uid, datasourceUid]
  );

  useEffect(() => {
    const teardown = model.updatePanelShowAlwaysMenu(groupByActionRender);

    return teardown;
  }, [groupByActionRender, model, panel]);

  return (
    <>
      {!model.state.hideGroupByAction && groupByActionRender && (
        <PanelGroupByAction groupByVariable={groupByVariable!} queries={queries} />
      )}
    </>
  );
}

function checkGroupByActionRender(
  queryRunner: SceneQueryRunner | null,
  groupByVariable: GroupByVariable | undefined,
  groupByDsUid: string | undefined,
  panelDsUid: string | undefined
): boolean {
  if (!groupByVariable || !queryRunner) {
    return false;
  }

  const dsUid = sceneGraph.interpolate(queryRunner, panelDsUid);
  return Boolean(
    dsUid === sceneGraph.interpolate(groupByVariable, groupByDsUid) && groupByVariable.isApplicabilityEnabled()
  );
}
