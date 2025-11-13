import { useEffect, useMemo, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectState,
  SceneObjectBase,
  VizPanel,
  sceneGraph,
  AdHocFiltersVariable,
  GroupByVariable,
  SceneQueryRunner,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema/dist/esm/index.gen';

import { PanelNonApplicableFiltersSubHeader } from './PanelNonApplicableFiltersSubHeader';

export interface VizPanelSubHeaderState extends SceneObjectState {
  hideNonApplicableFilters?: boolean;
  // todo dont need this just get it off SQR
  datasourceRef?: DataSourceRef | null;
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

    const dataObject = panel ? sceneGraph.getData(panel) : undefined;

    this._subs.add(
      dataObject?.subscribeToState((state) => {
        const queryRunner = state.$data;

        if (!(queryRunner instanceof SceneQueryRunner)) {
          return;
        }

        this.setState({ datasourceRef: queryRunner.state.datasource });
      })
    );
  };

  public getAdHocFiltersVariable(): AdHocFiltersVariable | undefined {
    return sceneGraph.getVariables(this).state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
  }

  public getGroupByVariable(): GroupByVariable | undefined {
    return sceneGraph.getVariables(this).state.variables.find((variable) => variable instanceof GroupByVariable);
  }
}

export function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const [shouldRenderFilters, setShouldRenderFilters] = useState(false);
  const { datasourceRef } = model.useState();

  const panel = model.parent;
  const dataObject = panel ? sceneGraph.getData(panel) : undefined;
  const data = dataObject?.useState();
  const queries = useMemo(() => data?.data?.request?.targets ?? [], [data]);
  const adhocFiltersVariable = model.getAdHocFiltersVariable();
  const groupByVariable = model.getGroupByVariable();
  const hasVariables = Boolean(adhocFiltersVariable || groupByVariable);

  useEffect(() => {
    if (model.state.hideNonApplicableFilters || !hasVariables || !datasourceRef) {
      setShouldRenderFilters(false);
      return;
    }

    const checkDatasourceSupport = async () => {
      try {
        const datasourceSrv = getDataSourceSrv();
        const datasource = await datasourceSrv.get(datasourceRef);
        setShouldRenderFilters(Boolean(datasource?.getDrilldownsApplicability));
      } catch (error) {
        console.error('Error checking datasource for getDrilldownsApplicability:', error);
        setShouldRenderFilters(false);
      }
    };

    checkDatasourceSupport();
  }, [datasourceRef, hasVariables, model.state.hideNonApplicableFilters]);

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
