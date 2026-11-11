import { useEffect } from 'react';

import { type DataSourceApi } from '@grafana/data';
import { getPanelDataStatusItems } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  type SceneObjectState,
  type SceneObjectRef,
  type VizPanel,
} from '@grafana/scenes';
import { PanelContextProvider } from '@grafana/ui';
import { usePanelStatusSnapshot } from '@grafana/ui/unstable';
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

  static Component = InspectErrorsAndNoticesTabRenderer;
}

function InspectErrorsAndNoticesTabRenderer({ model }: SceneComponentProps<InspectErrorsAndNoticesTab>) {
  const { panelRef, dataSource } = model.useState();
  const panel = panelRef.resolve();
  const context = panel.getPanelContext();
  const { activateNotices } = context;
  useEffect(() => activateNotices?.(), [activateNotices]);
  const snapshot = usePanelStatusSnapshot(context.notices);
  const { data: panelData } = sceneGraph.getData(panel).useState();
  const errors = panelData?.errors ?? (panelData?.error ? [panelData.error] : []);

  const CustomInspector = dataSource?.components?.ErrorsAndNoticesInspector;
  if (CustomInspector) {
    return panelData ? <CustomInspector datasource={dataSource} data={panelData.series} errors={errors} /> : null;
  }
  const statusItems = snapshot.hostInitialized
    ? snapshot.items
    : [...getPanelDataStatusItems(panelData, panel.state._pluginLoadError), ...snapshot.items];
  if (context.notices || panel.state._pluginLoadError) {
    return (
      <PanelContextProvider value={context}>
        <StandardErrorsAndNoticesInspector statusItems={statusItems} />
      </PanelContextProvider>
    );
  }
  if (!panelData) {
    return null;
  }
  return <StandardErrorsAndNoticesInspector data={panelData.series} errors={errors} />;
}
