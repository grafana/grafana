import { LoadingState } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useFlagTableInspectDataTableNG } from '@grafana/runtime/internal';
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

  static Component = InspectDataTabComponent;
}

function InspectDataTabComponent({ model }: SceneComponentProps<InspectDataTab>) {
  const { options } = model.useState();
  const panel = model.state.panelRef.resolve();
  const dataProvider = sceneGraph.getData(panel);
  const { data } = getDataProviderToSubscribeTo(dataProvider, options.withTransforms).useState();
  const timeRange = sceneGraph.getTimeRange(panel);
  const useTableNG = useFlagTableInspectDataTableNG();

  if (!data) {
    <div>
      <Trans i18nKey="dashboard-scene.inspect-data-tab.no-data-found">No data found</Trans>
    </div>;
  }

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
      useTableNG={useTableNG}
    />
  );
}

/**
 * Whether anything at all transforms this panel's data, so the toggle that switches the tab between
 * the query result and the rendered frames is worth offering. A panel whose plugin registered
 * transformations and whose user list is empty still renders frames the query did not return.
 *
 * System transformations share this list with the user's, so the plain length check covers both.
 * Asking the plugin whether it registers any would be a different question — they are installed only
 * while the feature toggle is on, and a toggle that switches between two identical views is worse
 * than no toggle.
 */
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
