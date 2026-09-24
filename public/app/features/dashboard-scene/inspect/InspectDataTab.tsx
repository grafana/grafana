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

  const { data: transformedData } = dataProvider.useState();
  const { data: sourceData } = getQuerySourceOf(dataProvider).useState();
  const data = options.withTransforms ? transformedData : sourceData;
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
 * Whether anything transforms this panel's data
 */
function hasTransformations(dataProvider: SceneDataProvider) {
  if (!(dataProvider instanceof SceneDataTransformer)) {
    return false;
  }

  if (dataProvider.state.transformations.length > 0) {
    return true;
  }

  const { prepend, append } = dataProvider.getResolvedSystemTransformations();

  return prepend.length > 0 || append.length > 0;
}

/** The query result before this panel's transformations. */
function getQuerySourceOf(dataProvider: SceneDataProvider): SceneDataProvider {
  if (dataProvider instanceof SceneDataTransformer && dataProvider.state.$data) {
    return dataProvider.state.$data;
  }

  return dataProvider;
}
