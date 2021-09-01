import React, { useState } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { PanelPlugin } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { StoreState } from 'app/types';
import { GetDataOptions } from '../../../query/state/PanelQueryRunner';
import { usePanelLatestData } from '../PanelEditor/usePanelLatestData';
import { InspectContent } from './InspectContent';
import { useDatasourceMetadata, useInspectTabs } from './hooks';
import { useLocation } from 'react-router-dom';
import { InspectTab } from 'app/features/inspector/types';

interface OwnProps {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export interface ConnectedProps {
  plugin?: PanelPlugin | null;
}

export type Props = OwnProps & ConnectedProps;

const PanelInspectorUnconnected: React.FC<Props> = ({ panel, dashboard, plugin }) => {
  const [dataOptions, setDataOptions] = useState<GetDataOptions>({
    withTransforms: false,
    withFieldConfig: true,
  });

  const location = useLocation();
  const { data, isLoading, error } = usePanelLatestData(panel, dataOptions, true);
  const metaDs = useDatasourceMetadata(data);
  const tabs = useInspectTabs(panel, dashboard, plugin, error, metaDs);
  const defaultTab = new URLSearchParams(location.search).get('inspectTab') as InspectTab;

  const onClose = () => {
    locationService.partial({
      inspect: null,
      inspectTab: null,
    });
  };

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

export const PanelInspector = connect(mapStateToProps)(PanelInspectorUnconnected);
