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
} from '@grafana/scenes';

import { PanelNonApplicableDrilldownsSubHeader } from './PanelNonApplicableDrilldownsSubHeader';

export interface VizPanelSubHeaderState extends SceneObjectState {
  hideNonApplicableDrilldowns?: boolean;
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
  };

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

export function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const data = model.getData();
  const queryRunner = model.getQueryRunner(data);

  const queries = data?.data?.request?.targets ?? [];

  const { variables } = sceneGraph.getVariables(model).useState();
  const datasourceUid = queryRunner?.state.datasource?.uid;

  const interpolatedUid = useMemo(
    () => (queryRunner ? sceneGraph.interpolate(queryRunner, datasourceUid) : undefined),
    [queryRunner, datasourceUid]
  );

  const adhocFiltersVariable = useMemo(
    () => variables.find((variable) => variable instanceof AdHocFiltersVariable),
    [variables]
  );
  const groupByVariable = useMemo(() => variables.find((variable) => variable instanceof GroupByVariable), [variables]);

  const supportsApplicability = useMemo(
    () => supportsDrilldownsApplicability(interpolatedUid, adhocFiltersVariable, groupByVariable),
    [interpolatedUid, adhocFiltersVariable, groupByVariable]
  );

  if (!datasourceUid || model.state.hideNonApplicableDrilldowns || !supportsApplicability) {
    return null;
  }

  return (
    <PanelNonApplicableDrilldownsSubHeader
      filtersVar={adhocFiltersVariable}
      groupByVar={groupByVariable}
      queries={queries}
    />
  );
}

function supportsDrilldownsApplicability(
  dsUid: string | undefined,
  filtersVar?: AdHocFiltersVariable,
  groupByVar?: GroupByVariable
) {
  if (
    dsUid &&
    filtersVar &&
    filtersVar.isApplicabilityEnabled() &&
    dsUid === sceneGraph.interpolate(filtersVar, filtersVar.state.datasource?.uid)
  ) {
    return true;
  }

  if (
    dsUid &&
    groupByVar &&
    groupByVar.isApplicabilityEnabled() &&
    dsUid === sceneGraph.interpolate(groupByVar, groupByVar.state.datasource?.uid)
  ) {
    return true;
  }

  return false;
}
