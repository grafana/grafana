import React from 'react';

import { LoadingState } from '@grafana/data';
import {
  SceneComponentProps,
  SceneDataProvider,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
} from '@grafana/scenes';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { InspectDataTab as InspectDataTabOld } from '../../inspector/InspectDataTab';

import { InspectTabState } from './types';

export interface InspectDataTabState extends InspectTabState {
  options: GetDataOptions;
}

export class InspectDataTab extends SceneObjectBase<InspectDataTabState> {
  public constructor(state: Omit<InspectDataTabState, 'options'>) {
    super({
      ...state,
      options: {
        withTransforms: true,
        withFieldConfig: true,
      },
    });
  }

  public onOptionsChange = (options: GetDataOptions) => {
    this.setState({ options });
  };

  static Component = ({ model }: SceneComponentProps<InspectDataTab>) => {
    const { options } = model.useState();
    const panel = model.state.panelRef.resolve();
    const dataProvider = sceneGraph.getData(panel);
    const { data } = getDataProviderToSubscribeTo(dataProvider, options.withTransforms).useState();
    const timeRange = sceneGraph.getTimeRange(panel);

    if (!data) {
      <div>No data found</div>;
    }

    return (
      <InspectDataTabOld
        isLoading={data?.state === LoadingState.Loading}
        data={data?.series}
        options={options}
        hasTransformations={hasTransformations(dataProvider)}
        timeZone={timeRange.getTimeZone()}
        panelPluginId={panel.state.pluginId}
        dataName={panel.state.title}
        fieldConfig={panel.state.fieldConfig}
        onOptionsChange={model.onOptionsChange}
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
  if (withTransforms && dataProvider instanceof SceneDataTransformer) {
    return dataProvider.state.$data!;
  }

  return dataProvider;
}
