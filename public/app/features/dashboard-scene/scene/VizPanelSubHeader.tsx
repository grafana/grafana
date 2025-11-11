import { useEffect, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectState, SceneObjectBase, VizPanel, sceneGraph } from '@grafana/scenes';

import { PanelNonApplicableFiltersSubHeader } from './PanelNonApplicableFiltersSubHeader';

export interface VizPanelSubHeaderState extends SceneObjectState {
  nonApplicableFiltersSubHeader: PanelNonApplicableFiltersSubHeader;
  hideNonApplicableFilters?: boolean;
}

export class VizPanelSubHeader extends SceneObjectBase<VizPanelSubHeaderState> {
  static Component = VizPanelSubHeaderRenderer;

  constructor(state: Partial<VizPanelSubHeaderState>) {
    super({
      nonApplicableFiltersSubHeader: new PanelNonApplicableFiltersSubHeader({}),
      ...state,
    });
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('VizPanelSubHeader can be used only for VizPanel');
    }
  };
}

function VizPanelSubHeaderRenderer({ model }: SceneComponentProps<VizPanelSubHeader>) {
  const [shouldRenderFilters, setShouldRenderFilters] = useState(false);

  const { nonApplicableFiltersSubHeader } = model.useState();

  const panel = model.parent;
  const dataObject = panel ? sceneGraph.getData(panel) : undefined;
  const data = dataObject?.useState();

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
          Boolean(
            ds &&
              ds.getDrilldownsApplicability &&
              (nonApplicableFiltersSubHeader.getAdHocFiltersVariable() ||
                nonApplicableFiltersSubHeader.getGroupByVariable())
          )
        );
      } catch (error) {
        console.error('Error checking datasource for getDrilldownsApplicability:', error);
        setShouldRenderFilters(false);
      }
    };

    checkDatasourceDrilldownsApplicability();
  }, [panel, data, model, nonApplicableFiltersSubHeader]);

  if (!shouldRenderFilters) {
    return null;
  }

  return <nonApplicableFiltersSubHeader.Component model={nonApplicableFiltersSubHeader} />;
}
