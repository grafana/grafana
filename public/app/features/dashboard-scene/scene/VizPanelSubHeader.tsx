import { Unsubscribable } from 'rxjs';

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
import { DataSourceRef } from '@grafana/schema';

import { verifyDrilldownApplicability } from '../utils/drilldownUtils';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';

import { PanelNonApplicableDrilldownsSubHeader } from './PanelNonApplicableDrilldownsSubHeader';

interface ApplicabilitySupportHelperState {
  datasource: DataSourceRef | null;
  applicabilityEnabled?: boolean;
}

export interface VizPanelSubHeaderState extends SceneObjectState {
  hideNonApplicableDrilldowns?: boolean;
  supportsApplicability?: boolean;
}

export class VizPanelSubHeader extends SceneObjectBase<VizPanelSubHeaderState> {
  static Component = VizPanelSubHeaderRenderer;

  private _adHocVar?: AdHocFiltersVariable;
  private _groupByVar?: GroupByVariable;

  private _adHocSub?: Unsubscribable;
  private _groupBySub?: Unsubscribable;

  private _queryRunnerDatasource?: DataSourceRef | null;

  constructor(state: Partial<VizPanelSubHeaderState>) {
    super({
      hideNonApplicableDrilldowns: state.hideNonApplicableDrilldowns ?? false,
      ...state,
    });

    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    if (!this.parent || !(this.parent instanceof VizPanel)) {
      throw new Error('VizPanelSubHeader can be used only with VizPanel');
    }

    if (!this.state.hideNonApplicableDrilldowns) {
      this.subscribeToDrilldownVariableChanges();
    }

    return () => {
      this._groupBySub?.unsubscribe();
      this._adHocSub?.unsubscribe();
    };
  };

  private subscribeToDrilldownVariableChanges() {
    const vars = sceneGraph.getVariables(this);
    const queryRunner = this.getQueryRunner();

    this._adHocVar = vars.state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
    this._groupByVar = vars.state.variables.find((variable) => variable instanceof GroupByVariable);
    this._queryRunnerDatasource = queryRunner ? getDatasourceFromQueryRunner(queryRunner) : undefined;

    this.setDrilldownApplicabilitySupportHelper();

    // keep track of queryRunner datasource updates and update rendering
    this._subs.add(
      queryRunner?.subscribeToState((n, p) => {
        // Datasource can be on queryRunner itself (mixed panels) or on the first query
        if (n.datasource !== p.datasource || n.queries !== p.queries) {
          this._queryRunnerDatasource = getDatasourceFromQueryRunner(queryRunner);

          this.setDrilldownApplicabilitySupportHelper();
        }
      })
    );

    // check when var set updates and search for drilldown vars
    this._subs.add(
      vars.subscribeToState((n) => {
        this._adHocVar = n.variables.find((variable) => variable instanceof AdHocFiltersVariable);
        this._groupByVar = n.variables.find((variable) => variable instanceof GroupByVariable);

        this.refreshDrilldownVarsSubscriptions();
      })
    );

    // adhoc sub so if that changes, we potentially update rendering
    this._adHocSub = this._adHocVar?.subscribeToState((n, p) => {
      if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
        this.setDrilldownApplicabilitySupportHelper({
          datasource: n.datasource,
          applicabilityEnabled: n.applicabilityEnabled,
        });
      }
    });

    // same for groupBy
    this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
      if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
        this.setDrilldownApplicabilitySupportHelper(undefined, {
          datasource: n.datasource,
          applicabilityEnabled: n.applicabilityEnabled,
        });
      }
    });
  }

  private refreshDrilldownVarsSubscriptions() {
    if (this._groupByVar) {
      this._groupBySub?.unsubscribe();
      this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
          this.setDrilldownApplicabilitySupportHelper(undefined, {
            datasource: n.datasource,
            applicabilityEnabled: n.applicabilityEnabled,
          });
        }
      });
    }

    if (this._adHocVar) {
      this._adHocSub?.unsubscribe();
      this._adHocSub = this._adHocVar?.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
          this.setDrilldownApplicabilitySupportHelper({
            datasource: n.datasource,
            applicabilityEnabled: n.applicabilityEnabled,
          });
        }
      });
    }
  }

  private setDrilldownApplicabilitySupportHelper(
    adHocData?: ApplicabilitySupportHelperState,
    groupByData?: ApplicabilitySupportHelperState
  ) {
    this.setState({
      supportsApplicability:
        verifyDrilldownApplicability(
          this,
          this._queryRunnerDatasource,
          adHocData?.datasource ?? this._adHocVar?.state.datasource ?? null,
          adHocData?.applicabilityEnabled ?? this._adHocVar?.state.applicabilityEnabled ?? false
        ) ||
        verifyDrilldownApplicability(
          this,
          this._queryRunnerDatasource,
          groupByData?.datasource ?? this._groupByVar?.state.datasource ?? null,
          groupByData?.applicabilityEnabled ?? this._groupByVar?.state.applicabilityEnabled ?? false
        ),
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

export function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const { supportsApplicability, hideNonApplicableDrilldowns } = model.useState();
  const variables = sceneGraph.getVariables(model);
  const adhocFiltersVar = variables.state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
  const groupByVar = variables.state.variables.find((variable) => variable instanceof GroupByVariable);
  const queryRunner = model.getQueryRunner();

  if (!queryRunner || hideNonApplicableDrilldowns || !supportsApplicability) {
    return null;
  }

  return (
    <PanelNonApplicableDrilldownsSubHeader
      filtersVar={adhocFiltersVar}
      groupByVar={groupByVar}
      queryRunner={queryRunner}
    />
  );
}
