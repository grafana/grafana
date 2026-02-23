import { Unsubscribable } from 'rxjs';

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
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';

import { PanelGroupByAction } from './panel-actions/PanelGroupByAction/PanelGroupByAction';

export interface VizPanelHeaderActionsState extends SceneObjectState {
  hideGroupByAction?: boolean;
  supportsApplicability?: boolean;
  isGroupByActionSupported?: boolean;
}

export class VizPanelHeaderActions extends SceneObjectBase<VizPanelHeaderActionsState> {
  static Component = VizPanelHeaderActionsRenderer;

  private _groupByVar?: GroupByVariable;
  private _groupBySub?: Unsubscribable;
  private _queryRunnerDatasource?: DataSourceRef | null;

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

    return () => {
      this._groupBySub?.unsubscribe();
    };
  };

  // checks if applicability is supported, otherwise no point in using this action, will show same
  // results as the dashboard groupBy var
  private setApplicabilitySupport(groupByDs?: DataSourceRef | null, groupByApplicability?: boolean) {
    const supportsApplicability = verifyDrilldownApplicability(
      this,
      this._queryRunnerDatasource,
      groupByDs ?? this._groupByVar?.state.datasource ?? null,
      groupByApplicability ?? this._groupByVar?.state.applicabilityEnabled ?? false
    );

    if (supportsApplicability !== this.state.supportsApplicability) {
      this.setState({ supportsApplicability });
    }
  }

  // checks if the action should appear on the panel aka if the DSs match
  private updateGroupByActionSupport() {
    const queryRunner = this.getQueryRunner();
    const queries = queryRunner?.state.queries ?? [];
    const groupByDsUid = this._groupByVar?.state.datasource?.uid
      ? sceneGraph.interpolate(this, this._groupByVar.state.datasource.uid)
      : undefined;

    const isGroupByActionSupported = Boolean(
      this._groupByVar &&
        groupByDsUid &&
        queries.some((q) => sceneGraph.interpolate(this, q.datasource?.uid) === groupByDsUid)
    );

    if (isGroupByActionSupported !== this.state.isGroupByActionSupported) {
      this.setState({ isGroupByActionSupported });
    }
  }

  private subscribeToGroupByChanges() {
    const vars = sceneGraph.getVariables(this);
    const queryRunner = this.getQueryRunner();

    this._groupByVar = vars.state.variables.find((variable) => variable instanceof GroupByVariable);
    this._queryRunnerDatasource = queryRunner ? getDatasourceFromQueryRunner(queryRunner) : undefined;

    this.setApplicabilitySupport();
    this.updateGroupByActionSupport();

    this._subs.add(
      vars.subscribeToState((n) => {
        this._groupByVar = n.variables.find((variable) => variable instanceof GroupByVariable);

        this._groupBySub?.unsubscribe();

        if (this._groupByVar) {
          this._groupBySub = this._groupByVar.subscribeToState((n, p) => {
            if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
              this.setApplicabilitySupport(n.datasource, n.applicabilityEnabled);
              this.updateGroupByActionSupport();
            }
          });
        }

        this.setApplicabilitySupport();
        this.updateGroupByActionSupport();
      })
    );

    this._subs.add(
      queryRunner?.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource || n.queries !== p.queries) {
          this._queryRunnerDatasource = getDatasourceFromQueryRunner(queryRunner);

          this.setApplicabilitySupport();
          this.updateGroupByActionSupport();
        }
      })
    );

    this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
      if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
        this.setApplicabilitySupport(n.datasource, n.applicabilityEnabled);
        this.updateGroupByActionSupport();
      }
    });
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
  const { hideGroupByAction, supportsApplicability, isGroupByActionSupported } = model.useState();
  const variables = sceneGraph.getVariables(model);
  const groupByVariable = variables.state.variables.find((variable) => variable instanceof GroupByVariable);
  const queryRunner = model.getQueryRunner();
  const queries = queryRunner?.state.queries ?? [];

  return (
    <>
      {!hideGroupByAction && supportsApplicability && isGroupByActionSupported && groupByVariable && (
        <div className="show-on-hover">
          <PanelGroupByAction groupByVariable={groupByVariable} queries={queries} />
        </div>
      )}
    </>
  );
}
