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

import { StandardErrorsAndNoticesInspector } from './StandardErrorsAndNoticesInspector';

export interface InspectErrorsAndNoticesTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  // The data source is only set when it provides a custom ErrorsAndNoticesInspector. Otherwise
  // the standard inspector is used, which works for any data source (including mixed).
  dataSource?: DataSourceApi;
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

    if (!data.state.data) {
      return null;
    }

    const panelData = data.state.data;
    const errors = panelData.errors ?? (panelData.error ? [panelData.error] : []);

    const CustomInspector = dataSource?.components?.ErrorsAndNoticesInspector;
    if (CustomInspector) {
      return <CustomInspector datasource={dataSource} data={panelData.series} errors={errors} />;
    }

    return <StandardErrorsAndNoticesInspector data={panelData.series} errors={errors} />;
  };
}
