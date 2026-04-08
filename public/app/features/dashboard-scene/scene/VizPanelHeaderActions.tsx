import { type Unsubscribable } from 'rxjs';

import {
  AdHocFiltersVariable,
  GroupByVariable,
  type SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  type SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';

import { PanelGroupByAction } from './panel-actions/PanelGroupByAction/PanelGroupByAction';

export interface VizPanelHeaderActionsState extends SceneObjectState {
  hideGroupByAction?: boolean;
  isGroupByActionSupported?: boolean;
}

export class VizPanelHeaderActions extends SceneObjectBase<VizPanelHeaderActionsState> {
  static Component = VizPanelHeaderActionsRenderer;

  private _groupByVar?: GroupByVariable;
  private _adhocGroupByVar?: AdHocFiltersVariable;
  private _groupBySub?: Unsubscribable;

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

  private updateGroupByActionSupport() {
    const queryRunner = this.getQueryRunner();
    const queries = queryRunner?.state.queries ?? [];

    let groupByDsUid: string | undefined;

    if (this._groupByVar?.state.datasource?.uid) {
      groupByDsUid = sceneGraph.interpolate(this, this._groupByVar.state.datasource.uid);
    } else if (this._adhocGroupByVar?.state.enableGroupBy && this._adhocGroupByVar.state.datasource?.uid) {
      groupByDsUid = sceneGraph.interpolate(this, this._adhocGroupByVar.state.datasource.uid);
    }

    const hasGroupByVar = Boolean(this._groupByVar || this._adhocGroupByVar?.state.enableGroupBy);

    let queryDsMatchesGroupBy = false;
    if (groupByDsUid) {
      if (queryRunner?.state.datasource?.uid) {
        queryDsMatchesGroupBy = sceneGraph.interpolate(this, queryRunner.state.datasource.uid) === groupByDsUid;
      } else {
        queryDsMatchesGroupBy = queries.some(
          (q) => q.datasource?.uid && sceneGraph.interpolate(this, q.datasource.uid) === groupByDsUid
        );
      }
    }

    const isGroupByActionSupported = Boolean(hasGroupByVar && groupByDsUid && queryDsMatchesGroupBy);

    if (isGroupByActionSupported !== this.state.isGroupByActionSupported) {
      this.setState({ isGroupByActionSupported });
    }
  }

  private subscribeToGroupByChanges() {
    const vars = sceneGraph.getVariables(this);
    const queryRunner = this.getQueryRunner();

    this._groupByVar = vars.state.variables.find(
      (variable): variable is GroupByVariable => variable instanceof GroupByVariable
    );
    this._adhocGroupByVar = vars.state.variables.find(
      (variable): variable is AdHocFiltersVariable =>
        variable instanceof AdHocFiltersVariable && variable.state.enableGroupBy === true
    );

    this.updateGroupByActionSupport();

    this._subs.add(
      vars.subscribeToState((n) => {
        this._groupByVar = n.variables.find(
          (variable): variable is GroupByVariable => variable instanceof GroupByVariable
        );
        this._adhocGroupByVar = n.variables.find(
          (variable): variable is AdHocFiltersVariable =>
            variable instanceof AdHocFiltersVariable && variable.state.enableGroupBy === true
        );

        this._groupBySub?.unsubscribe();

        if (this._groupByVar) {
          this._groupBySub = this._groupByVar.subscribeToState((n, p) => {
            if (n.datasource !== p.datasource) {
              this.updateGroupByActionSupport();
            }
          });
        } else if (this._adhocGroupByVar) {
          this._groupBySub = this._adhocGroupByVar.subscribeToState((n, p) => {
            if (n.datasource !== p.datasource || n.enableGroupBy !== p.enableGroupBy) {
              this.updateGroupByActionSupport();
            }
          });
        }

        this.updateGroupByActionSupport();
      })
    );

    this._subs.add(
      queryRunner?.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource || n.queries !== p.queries) {
          this.updateGroupByActionSupport();
        }
      })
    );

    this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
      if (n.datasource !== p.datasource) {
        this.updateGroupByActionSupport();
      }
    });

    if (!this._groupBySub && this._adhocGroupByVar) {
      this._groupBySub = this._adhocGroupByVar.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource || n.enableGroupBy !== p.enableGroupBy) {
          this.updateGroupByActionSupport();
        }
      });
    }
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
  const { hideGroupByAction, isGroupByActionSupported } = model.useState();
  const variables = sceneGraph.getVariables(model);
  const groupByVariable = variables.state.variables.find(
    (variable): variable is GroupByVariable => variable instanceof GroupByVariable
  );
  const adhocGroupByVariable = variables.state.variables.find(
    (variable): variable is AdHocFiltersVariable =>
      variable instanceof AdHocFiltersVariable && variable.state.enableGroupBy === true
  );
  const queryRunner = model.getQueryRunner();
  const queries = queryRunner?.state.queries ?? [];

  return (
    <>
      {!hideGroupByAction && isGroupByActionSupported && (groupByVariable || adhocGroupByVariable) && (
        <div className="show-on-hover">
          <PanelGroupByAction
            groupByVariable={groupByVariable}
            adhocGroupByVariable={adhocGroupByVariable}
            queries={queries}
          />
        </div>
      )}
    </>
  );
}
