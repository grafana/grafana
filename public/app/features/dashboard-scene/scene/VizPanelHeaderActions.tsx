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
    this._queryRunnerDatasource = queryRunner ? getDatasourceFromQueryRunner(queryRunner) : undefined;

    this.setAplicabilitySupport();

    // check when var set updates and search for groupBy var
    this._subs.add(
      vars.subscribeToState((n) => {
        this._groupByVar = n.variables.find((variable) => variable instanceof GroupByVariable);

        if (this._groupByVar) {
          this._groupBySub?.unsubscribe();
          this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
            if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
              this.setAplicabilitySupport(n.datasource, n.applicabilityEnabled);
            }
          });
        }
      })
    );

    // update query runner datasource changes
    this._subs.add(
      queryRunner?.subscribeToState((n, p) => {
        // Datasource can be on queryRunner itself (mixed panels) or on the first query
        if (n.datasource !== p.datasource || n.queries !== p.queries) {
          this._queryRunnerDatasource = getDatasourceFromQueryRunner(queryRunner);

          this.setAplicabilitySupport();
        }
      })
    );

    this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
      if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
        this.setAplicabilitySupport(n.datasource, n.applicabilityEnabled);
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
  const { hideGroupByAction, supportsApplicability } = model.useState();
  const variables = sceneGraph.getVariables(model);
  const groupByVariable = variables.state.variables.find((variable) => variable instanceof GroupByVariable);
  const queryRunner = model.getQueryRunner();
  const queries = queryRunner?.state.queries ?? [];

  return (
    <>
      {!hideGroupByAction && supportsApplicability && (
        <div className="show-on-hover">
          <PanelGroupByAction groupByVariable={groupByVariable!} queries={queries} />
        </div>
      )}
    </>
  );
}
