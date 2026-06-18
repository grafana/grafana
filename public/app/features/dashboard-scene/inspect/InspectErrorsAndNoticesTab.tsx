import { type DataSourceApi } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  type SceneObjectState,
  type SceneObjectRef,
  type VizPanel,
} from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';

export interface InspectErrorsAndNoticesTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  dataSource: DataSourceApi;
}

export class InspectErrorsAndNoticesTab extends SceneObjectBase<InspectErrorsAndNoticesTabState> {
  public getTabLabel() {
    return t('dashboard.inspect.errors-and-notices-tab', 'Errors and notices');
  }

  public getTabValue() {
    return InspectTab.ErrorsAndNotices;
  }

  static Component = ({ model }: SceneComponentProps<InspectErrorsAndNoticesTab>) => {
    const { panelRef, dataSource } = model.state;
    const data = sceneGraph.getData(panelRef.resolve());
    const Inspector = dataSource.components?.ErrorsAndNoticesInspector;

    if (!data.state.data || !Inspector) {
      return null;
    }

    const panelData = data.state.data;
    const errors = panelData.errors ?? (panelData.error ? [panelData.error] : []);

    return <Inspector datasource={dataSource} data={panelData.series} errors={errors} />;
  };
}
