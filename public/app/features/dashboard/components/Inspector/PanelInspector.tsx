import React, { useCallback, useState } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

import { PanelPlugin } from '@grafana/data';
import { StoreState } from 'app/types';
import { GetDataOptions } from '../../state/PanelQueryRunner';
import { usePanelLatestData } from '../PanelEditor/usePanelLatestData';
import { InspectContent } from './InspectContent';
import { useDatasourceMetadata, useInspectTabs } from './hooks';
import { InspectTab } from './types';
import { updateLocation } from 'app/core/actions';

interface OwnProps {
  dashboard: DashboardModel;
  panel: PanelModel;
  defaultTab: InspectTab;
}

export interface ConnectedProps {
  plugin?: PanelPlugin | null;
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

const PanelInspectorUnconnected: React.FC<Props> = ({ panel, dashboard, defaultTab, plugin, updateLocation }) => {
  const [dataOptions, setDataOptions] = useState<GetDataOptions>({
    withTransforms: false,
    withFieldConfig: false,
  });
  const { data, isLoading, error } = usePanelLatestData(panel, dataOptions);
  const metaDs = useDatasourceMetadata(data);
  const tabs = useInspectTabs(plugin, dashboard, error, metaDs);
  const onClose = useCallback(() => {
    updateLocation({
      query: { inspect: null, inspectTab: null },
      partial: true,
    });
  }, [updateLocation]);

  if (!plugin) {
    return null;
  }

  return (
    <InspectContent
      dashboard={dashboard}
      panel={panel}
      plugin={plugin}
      defaultTab={defaultTab}
      tabs={tabs}
      data={data}
      isDataLoading={isLoading}
      dataOptions={dataOptions}
      onDataOptionsChange={setDataOptions}
      metadataDatasource={metaDs}
      onClose={onClose}
    />
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  const panelState = state.dashboard.panels[props.panel.id];
  if (!panelState) {
    return { plugin: null };
  }

  return {
    plugin: panelState.plugin,
  };
};
const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { updateLocation };

export const PanelInspector = connect(mapStateToProps, mapDispatchToProps)(PanelInspectorUnconnected);
