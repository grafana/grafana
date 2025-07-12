import { useState } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { useLocation } from 'react-router-dom-v5-compat';

import { PanelPlugin } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { StoreState } from 'app/types/store';

import { GetDataOptions } from '../../../query/state/PanelQueryRunner';
import { HelpWizard } from '../HelpWizard/HelpWizard';
import { usePanelLatestData } from '../PanelEditor/usePanelLatestData';

import { InspectContent } from './InspectContent';
import { useDatasourceMetadata, useInspectTabs } from './hooks';

interface OwnProps {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export interface ConnectedProps {
  plugin?: PanelPlugin | null;
}

export type Props = OwnProps & ConnectedProps;

const PanelInspectorUnconnected = ({ panel, dashboard, plugin }: Props) => {
  const location = useLocation();
  const defaultTab = new URLSearchParams(location.search).get('inspectTab') as InspectTab;
  const [dataOptions, setDataOptions] = useState<GetDataOptions>({
    withTransforms: defaultTab === InspectTab.Error,
    withFieldConfig: true,
  });

  const { data, isLoading, hasError } = usePanelLatestData(panel, dataOptions, false);
  const metaDs = useDatasourceMetadata(data);
  const tabs = useInspectTabs(panel, dashboard, plugin, hasError, metaDs);

  const onClose = () => {
    locationService.partial({
      inspect: null,
      inspectTab: null,
    });
  };

  if (!plugin) {
    return null;
  }

  if (defaultTab === InspectTab.Help) {
    return <HelpWizard panel={panel} plugin={plugin} onClose={onClose} />;
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
  const panelState = getPanelStateForModel(state, props.panel);
  if (!panelState) {
    return { plugin: null };
  }

  return {
    plugin: panelState.plugin,
  };
};

export const PanelInspector = connect(mapStateToProps)(PanelInspectorUnconnected);
