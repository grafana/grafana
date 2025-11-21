import { useMemo } from 'react';

import {
  GroupByVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { verifyDrilldownApplicability } from '../utils/drilldownUtils';

import { PanelGroupByAction } from './PanelGroupByAction';

export interface VizPanelHeaderActionsState extends SceneObjectState {
  hideGroupByAction?: boolean;
  supportsApplicability?: boolean;
}

export class VizPanelHeaderActions extends SceneObjectBase<VizPanelHeaderActionsState> {
  static Component = VizPanelHeaderActionsRenderer;

  private _groupByVar?: GroupByVariable;
  private _queryRunnerDatasource?: DataSourceRef;

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

    if (!this.state.hideGroupByAction) {
      this.subscribeToGroupByChanges();
    }
  };

  private setAplicabilitySupport(groupByDs?: DataSourceRef | null, groupByApplicability?: boolean) {
    this.setState({
      supportsApplicability: verifyDrilldownApplicability(
        this,
        this._queryRunnerDatasource,
        groupByDs ?? this._groupByVar?.state.datasource ?? null,
        groupByApplicability ?? this._groupByVar?.state.applicabilityEnabled ?? false
      ),
    });
  }

  private subscribeToGroupByChanges() {
    const vars = sceneGraph.getVariables(this);
    const queryRunner = this.getQueryRunner();

    this._groupByVar = vars.state.variables.find((variable) => variable instanceof GroupByVariable);
    this._queryRunnerDatasource = queryRunner?.state.datasource;

    this.setAplicabilitySupport();

    // check when var set updates and search for groupBy var
    this._subs.add(
      vars.subscribeToState((n) => {
        this._groupByVar = n.variables.find((variable) => variable instanceof GroupByVariable);
      })
    );

    // update query runner datasource changes
    this._subs.add(
      queryRunner?.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource) {
          this._queryRunnerDatasource = n.datasource;

          this.setAplicabilitySupport();
        }
      })
    );

    // add groupBy subscription to update the action
    this._subs.add(
      this._groupByVar?.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
          this.setAplicabilitySupport(n.datasource, n.applicabilityEnabled);
        }
      })
    );
  }

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

  public getQueryRunner() {
    const panel = this.parent;
    const dataObject = panel ? sceneGraph.getData(panel) : undefined;
    const queryRunner = dataObject?.state.$data;

    if (!queryRunner || !(queryRunner instanceof SceneQueryRunner)) {
      return null;
    }

    return queryRunner;
  }
}

export function VizPanelHeaderActionsRenderer({ model }: SceneComponentProps<VizPanelHeaderActions>) {
  const { hideGroupByAction, supportsApplicability } = model.useState();
  const variables = sceneGraph.getVariables(model);
  const queryRunner = model.getQueryRunner();
  const queries = queryRunner?.state.data?.request?.targets ?? [];

  const groupByVariable = useMemo(
    () => variables.state.variables.find((variable) => variable instanceof GroupByVariable),
    [variables]
  );

  return (
    <>
      {!hideGroupByAction && supportsApplicability && (
        <PanelGroupByAction groupByVariable={groupByVariable!} queries={queries} />
      )}
    </>
  );
}
