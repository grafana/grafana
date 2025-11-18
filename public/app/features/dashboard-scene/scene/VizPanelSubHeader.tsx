import { useMemo } from 'react';

import {
  SceneComponentProps,
  SceneObjectState,
  SceneObjectBase,
  sceneGraph,
  AdHocFiltersVariable,
  GroupByVariable,
  SceneQueryRunner,
  VizPanel,
  SceneDataState,
  sceneUtils,
} from '@grafana/scenes';

import { PanelNonApplicableDrilldownsSubHeader } from './PanelNonApplicableDrilldownsSubHeader';

export interface VizPanelSubHeaderState extends SceneObjectState {
  hideNonApplicableDrilldowns?: boolean;
  adhocFiltersVar?: AdHocFiltersVariable;
  groupByVar?: GroupByVariable;
}

export class VizPanelSubHeader extends SceneObjectBase<VizPanelSubHeaderState> {
  static Component = VizPanelSubHeaderRenderer;

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

    const variables = sceneGraph.getVariables(this).state.variables;
    const adhocFiltersVariable = variables.find((variable) => variable instanceof AdHocFiltersVariable);
    const groupByVariable = variables.find((variable) => variable instanceof GroupByVariable);

    this.setState({ adhocFiltersVar: adhocFiltersVariable, groupByVar: groupByVariable });
  };

  public getQueryRunner(): SceneQueryRunner | null {
    const panel = this.parent;
    const dataObject = panel ? sceneGraph.getData(panel) : undefined;
    const queryRunner = dataObject?.useState().$data;

    if (!queryRunner || !(queryRunner instanceof SceneQueryRunner)) {
      return null;
    }

    return queryRunner;
  }
}

export function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const { adhocFiltersVar, groupByVar } = model.useState();
  const queryRunner = model.getQueryRunner();

  const { applicabilityEnabled: filtersApplicabilityEnabled, datasource: filtersDatasource } =
    adhocFiltersVar?.useState() ?? { applicabilityEnabled: false, datasource: null };
  const { applicabilityEnabled: groupByApplicabilityEnabled, datasource: groupByDatasource } =
    groupByVar?.useState() ?? { applicabilityEnabled: false, datasource: null };
  const { datasource } = queryRunner?.useState() ?? { datasource: undefined };

  const supportsApplicability = useMemo(
    () =>
      sceneUtils.verifyDrilldownApplicability(model, datasource, filtersDatasource, filtersApplicabilityEnabled) ||
      sceneUtils.verifyDrilldownApplicability(model, datasource, groupByDatasource, groupByApplicabilityEnabled),
    [datasource, filtersApplicabilityEnabled, filtersDatasource, groupByApplicabilityEnabled, groupByDatasource, model]
  );

  if (!queryRunner || model.state.hideNonApplicableDrilldowns || !supportsApplicability) {
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
