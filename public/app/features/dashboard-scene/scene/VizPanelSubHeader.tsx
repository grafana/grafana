import { Unsubscribable } from 'rxjs';

import {
  SceneComponentProps,
  SceneObjectState,
  SceneObjectBase,
  sceneGraph,
  AdHocFiltersVariable,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { verifyDrilldownApplicability } from '../utils/drilldownUtils';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';

import { ApplicabilityManager } from './ApplicabilityManager';
import { DashboardScene } from './DashboardScene';
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
  private _adHocSub?: Unsubscribable;

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
      this._adHocSub?.unsubscribe();
    };
  };

  private subscribeToDrilldownVariableChanges() {
    const vars = sceneGraph.getVariables(this);
    const queryRunner = this.getQueryRunner();

    this._adHocVar = vars.state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
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
  }

  private refreshDrilldownVarsSubscriptions() {
    if (this._adHocVar) {
      this._adHocSub?.unsubscribe();
      this._adHocSub = this._adHocVar.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource || n.applicabilityEnabled !== p.applicabilityEnabled) {
          this.setDrilldownApplicabilitySupportHelper({
            datasource: n.datasource,
            applicabilityEnabled: n.applicabilityEnabled,
          });
        }
      });
    } else {
      this._adHocSub?.unsubscribe();
      this._adHocSub = undefined;
    }
  }

  private setDrilldownApplicabilitySupportHelper(adHocData?: ApplicabilitySupportHelperState) {
    this.setState({
      supportsApplicability: verifyDrilldownApplicability(
        this,
        this._queryRunnerDatasource,
        adHocData?.datasource ?? this._adHocVar?.state.datasource ?? null,
        adHocData?.applicabilityEnabled ?? this._adHocVar?.state.applicabilityEnabled ?? false
      ),
    });
  }

  public getApplicabilityManager(): ApplicabilityManager | undefined {
    try {
      const dashboard = sceneGraph.getAncestor(this, DashboardScene);
      return dashboard.state.$behaviors?.find(
        (b): b is ApplicabilityManager => b instanceof ApplicabilityManager
      );
    } catch {
      return undefined;
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

export function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const { supportsApplicability, hideNonApplicableDrilldowns } = model.useState();
  const variablesSet = sceneGraph.getVariables(model);
  const { variables } = variablesSet.useState();
  const adhocFiltersVar = variables.find((variable) => variable instanceof AdHocFiltersVariable);
  const panelKey = model.parent?.state.key;
  const applicabilityManager = model.getApplicabilityManager();
  const amState = applicabilityManager?.useState();
  const applicability = panelKey ? amState?.results.get(panelKey) : undefined;

  if (!panelKey || hideNonApplicableDrilldowns || !supportsApplicability) {
    return null;
  }

  return (
    <PanelNonApplicableDrilldownsSubHeader
      filtersVar={adhocFiltersVar}
      applicability={applicability}
    />
  );
}
