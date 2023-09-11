import React from 'react';

import { LoadingState } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { InspectDataTab as InspectDataTabOld } from '../../inspector/InspectDataTab';

import { InspectTabState } from './types';

export interface InspectDataTabState extends InspectTabState {
  options?: GetDataOptions;
}

export class InspectDataTab extends SceneObjectBase<InspectDataTabState> {
  constructor(state: InspectDataTabState) {
    super({
      ...state,
      options: {
        withTransforms: true,
        withFieldConfig: true,
      },
    });
  }

  static Component = ({ model }: SceneComponentProps<InspectDataTab>) => {
    const { options } = model.useState();
    const panel = model.state.panelRef.resolve();
    const data = sceneGraph.getData(panel).useState();
    const timeRange = sceneGraph.getTimeRange(panel);

    if (!data) {
      <div>No data found</div>;
    }

    return (
      <InspectDataTabOld
        isLoading={data.data?.state === LoadingState.Loading}
        data={data.data?.series}
        options={options!}
        timeZone={timeRange.getTimeZone()}
        dataName={panel.state.title}
      />
    );
  };
}
