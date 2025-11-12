import { useEffect, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectState,
  SceneObjectBase,
  VizPanel,
  sceneGraph,
  AdHocFiltersVariable,
  GroupByVariable,
} from '@grafana/scenes';

import { PanelNonApplicableFiltersSubHeader } from './PanelNonApplicableFiltersSubHeader';

export interface VizPanelSubHeaderState extends SceneObjectState {
  hideNonApplicableFilters?: boolean;
}

export class VizPanelSubHeader extends SceneObjectBase<VizPanelSubHeaderState> {
  static Component = VizPanelSubHeaderRenderer;

  constructor(state: Partial<VizPanelSubHeaderState>) {
    super(state);
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('VizPanelSubHeader can be used only for VizPanel');
    }
  };

  public getAdHocFiltersVariable(): AdHocFiltersVariable | undefined {
    return sceneGraph.getVariables(this).state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
  }

  public getGroupByVariable(): GroupByVariable | undefined {
    return sceneGraph.getVariables(this).state.variables.find((variable) => variable instanceof GroupByVariable);
  }
}

function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const [shouldRenderFilters, setShouldRenderFilters] = useState(false);

  const panel = model.parent;
  const dataObject = panel ? sceneGraph.getData(panel) : undefined;
  const data = dataObject?.useState();
  const queries = data?.data?.request?.targets ?? [];
  const adhocFiltersVariable = model.getAdHocFiltersVariable();
  const groupByVariable = model.getGroupByVariable();

  useEffect(() => {
    const checkDatasourceDrilldownsApplicability = async () => {
      const queries = data?.data?.request?.targets ?? [];
      const datasourceRef = queries.length > 0 ? queries[0].datasource : undefined;

      if (!datasourceRef) {
        setShouldRenderFilters(false);
        return;
      }

      try {
        const datasourceSrv = getDataSourceSrv();
        const ds = await datasourceSrv.get(datasourceRef);

        // only render if datasource supports applicability and we have either adhoc filters or group by variable
        setShouldRenderFilters(
          Boolean(ds && ds.getDrilldownsApplicability && (adhocFiltersVariable || groupByVariable))
        );
      } catch (error) {
        console.error('Error checking datasource for getDrilldownsApplicability:', error);
        setShouldRenderFilters(false);
      }
    };

    checkDatasourceDrilldownsApplicability();
  }, [panel, data, model, adhocFiltersVariable, groupByVariable]);

  if (!shouldRenderFilters) {
    return null;
  }

  return (
    <PanelNonApplicableFiltersSubHeader
      filtersVar={adhocFiltersVariable}
      groupByVar={groupByVariable}
      queries={queries}
    />
  );
}
