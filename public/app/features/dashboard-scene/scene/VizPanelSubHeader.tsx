import { useMemo } from 'react';

import { DataSourceRef } from '@grafana/data';
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

  const adHocFiltersState = adhocFiltersVariable?.useState();
  const groupByState = groupByVariable?.useState();

  const supportsApplicability = useMemo(
    () =>
      supportsDrilldownsApplicability(
        interpolatedUid,
        adhocFiltersVariable,
        groupByVariable,
        adHocFiltersState,
        groupByState
      ),
    [interpolatedUid, adhocFiltersVariable, groupByVariable, adHocFiltersState, groupByState]
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
  groupByVar?: GroupByVariable,
  adHocFiltersState?: { applicabilityEnabled?: boolean; datasource?: DataSourceRef | null },
  groupByState?: { applicabilityEnabled?: boolean; datasource?: DataSourceRef | null }
) {
  if (
    dsUid &&
    filtersVar &&
    adHocFiltersState?.applicabilityEnabled &&
    dsUid === sceneGraph.interpolate(filtersVar, adHocFiltersState?.datasource?.uid)
  ) {
    return true;
  }

  if (
    dsUid &&
    groupByVar &&
    groupByState?.applicabilityEnabled &&
    dsUid === sceneGraph.interpolate(groupByVar, groupByState?.datasource?.uid)
  ) {
    return true;
  }

  return false;
}
