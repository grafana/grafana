import { useEffect } from 'react';

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
import { PanelContextProvider, usePanelDiagnosticsSnapshot } from '@grafana/ui';
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
  const { activateDiagnostics } = context;
  useEffect(() => activateDiagnostics?.(), [activateDiagnostics]);
  const snapshot = usePanelDiagnosticsSnapshot(context.diagnostics);
  const { data: panelData } = sceneGraph.getData(panel).useState();
  const errors = panelData?.errors ?? (panelData?.error ? [panelData.error] : []);

  const CustomInspector = dataSource?.components?.ErrorsAndNoticesInspector;
  if (context.diagnostics) {
    return (
      <PanelContextProvider value={context}>
        <StandardErrorsAndNoticesInspector diagnostics={snapshot.items} />
        {CustomInspector && <CustomInspector datasource={dataSource} data={panelData?.series ?? []} errors={errors} />}
      </PanelContextProvider>
    );
  }
  if (!panelData) {
    return null;
  }
  return CustomInspector ? (
    <CustomInspector datasource={dataSource} data={panelData.series} errors={errors} />
  ) : (
    <StandardErrorsAndNoticesInspector data={panelData.series} errors={errors} />
  );
}
