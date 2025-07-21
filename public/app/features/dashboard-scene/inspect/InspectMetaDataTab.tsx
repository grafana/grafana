import { DataSourceApi } from '@grafana/data';
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

export interface InspectMetaDataTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  dataSource: DataSourceApi;
}

export class InspectMetaDataTab extends SceneObjectBase<InspectMetaDataTabState> {
  public getTabLabel() {
    return t('dashboard.inspect.meta-tab', 'Meta data');
  }

  public getTabValue() {
    return InspectTab.Meta;
  }

  static Component = ({ model }: SceneComponentProps<InspectMetaDataTab>) => {
    const { panelRef, dataSource } = model.state;
    const data = sceneGraph.getData(panelRef.resolve());
    const Inspector = dataSource.components?.MetadataInspector;

    if (!data.state.data || !Inspector) {
      return null;
    }

    return <Inspector datasource={dataSource} data={data.state.data.series} />;
  };
}
