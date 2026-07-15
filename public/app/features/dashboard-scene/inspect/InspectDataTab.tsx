import { LoadingState } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  type SceneDataProvider,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { InspectTab } from 'app/features/inspector/types';
import { type GetDataOptions } from 'app/features/query/state/PanelQueryRunner';
import { type TablePanelInstanceState } from 'app/plugins/panel/table/TablePanel';

import { InspectDataTab as InspectDataTabOld } from '../../inspector/InspectDataTab';

export interface InspectDataTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  options: GetDataOptions;
}

export class InspectDataTab extends SceneObjectBase<InspectDataTabState> {
  public constructor(state: Omit<InspectDataTabState, 'options'>) {
    super({
      ...state,
      options: {
        withTransforms: false,
        withFieldConfig: true,
      },
    });
  }

  public getTabLabel() {
    return t('dashboard.inspect.data-tab', 'Data');
  }

  public getTabValue() {
    return InspectTab.Data;
  }

  public onOptionsChange = (options: GetDataOptions) => {
    this.setState({ options });
  };

  static Component = ({ model }: SceneComponentProps<InspectDataTab>) => {
    const { options } = model.useState();
    const panel = model.state.panelRef.resolve();
    const { _pluginInstanceState } = panel.useState();
    const dataProvider = sceneGraph.getData(panel);
    const { data } = getDataProviderToSubscribeTo(dataProvider, options.withTransforms).useState();
    const timeRange = sceneGraph.getTimeRange(panel);

    if (!data) {
      <div>
        <Trans i18nKey="dashboard-scene.inspect-data-tab.no-data-found">No data found</Trans>
      </div>;
    }

    // Only the built-in table panel populates instanceState with this shape; other panel types may use
    // instanceState for unrelated purposes (see e.g. CanvasPanel), so this must stay gated on pluginId.
    const tableInstanceState: TablePanelInstanceState | undefined =
      panel.state.pluginId === 'table' ? _pluginInstanceState : undefined;

    return (
      <InspectDataTabOld
        isLoading={data?.state === LoadingState.Loading}
        data={data?.series}
        options={options}
        hasTransformations={hasTransformations(dataProvider)}
        timeZone={timeRange.getTimeZone()}
        panelPluginId={panel.state.pluginId}
        dataName={sceneGraph.interpolate(panel, panel.state.title)}
        fieldConfig={panel.state.fieldConfig}
        onOptionsChange={model.onOptionsChange}
        panelFilteredRowIndexes={tableInstanceState?.filteredRowIndexes}
        panelFilteredRowIndexesFrameIndex={tableInstanceState?.frameIndex}
      />
    );
  };
}

function hasTransformations(dataProvider: SceneDataProvider) {
  if (dataProvider instanceof SceneDataTransformer) {
    return dataProvider.state.transformations.length > 0;
  }

  return false;
}

function getDataProviderToSubscribeTo(dataProvider: SceneDataProvider, withTransforms: boolean) {
  if (!withTransforms && dataProvider instanceof SceneDataTransformer && dataProvider.state.$data) {
    return dataProvider.state.$data;
  }

  return dataProvider;
}
