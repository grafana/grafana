import { t } from '@grafana/i18n';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectRef,
  VizPanel,
} from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';

import { InspectStatsTab as OldInspectStatsTab } from '../../inspector/InspectStatsTab';

export interface InspectDataTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class InspectStatsTab extends SceneObjectBase<InspectDataTabState> {
  public getTabLabel() {
    return t('dashboard.inspect.stats-tab', 'Stats');
  }

  public getTabValue() {
    return InspectTab.Stats;
  }

  static Component = ({ model }: SceneComponentProps<InspectStatsTab>) => {
    const data = sceneGraph.getData(model.state.panelRef.resolve()).useState();
    const timeRange = sceneGraph.getTimeRange(model.state.panelRef.resolve());

    if (!data.data) {
      return null;
    }

    return <OldInspectStatsTab data={data.data} timeZone={timeRange.getTimeZone()} />;
  };
}
