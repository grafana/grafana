import { ReactElement, useEffect, useState } from 'react';

import { LoadingState, PanelMenuItem } from '@grafana/data';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { useSelector } from 'app/types';

import { DashboardModel, PanelModel } from '../../state';
import { getPanelMenu } from '../../utils/getPanelMenu';

interface PanelHeaderMenuProviderApi {
  items: PanelMenuItem[];
}

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  loadingState?: LoadingState;
  children: (props: PanelHeaderMenuProviderApi) => ReactElement;
}

export function PanelHeaderMenuProvider({ panel, dashboard, loadingState, children }: Props) {
  const [items, setItems] = useState<PanelMenuItem[]>([]);
  const angularComponent = useSelector((state) => getPanelStateForModel(state, panel)?.angularComponent);
  const { installed: isIncidentPluginInstalled } = usePluginBridge(SupportedPlugin.Incident);

  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, loadingState, angularComponent, isIncidentPluginInstalled));
  }, [dashboard, panel, angularComponent, loadingState, setItems, isIncidentPluginInstalled]);

  return children({ items });
}
