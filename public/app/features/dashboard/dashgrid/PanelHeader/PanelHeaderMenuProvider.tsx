import { ReactElement, useEffect, useMemo, useState } from 'react';

import {
  LoadingState,
  PanelMenuItem,
  PluginExtensionPanelContext,
  PluginExtensionPoints,
  getTimeZone,
} from '@grafana/data';
import { usePluginLinkExtensions } from '@grafana/runtime';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
// @todo: replace barrel import path
import { useSelector } from 'app/types/index';

// @todo: replace barrel import path
import { DashboardModel, PanelModel } from '../../state/index';
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
  const context = useMemo(() => createExtensionContext(panel, dashboard), [panel, dashboard]);
  const { extensions } = usePluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
    context,
    limitPerPlugin: 3,
  });

  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, extensions, angularComponent));
  }, [dashboard, panel, angularComponent, loadingState, setItems, extensions]);

  return children({ items });
}

function createExtensionContext(panel: PanelModel, dashboard: DashboardModel): PluginExtensionPanelContext {
  return {
    id: panel.id,
    pluginId: panel.type,
    title: panel.title,
    timeRange: dashboard.time,
    timeZone: getTimeZone({
      timeZone: dashboard.timezone,
    }),
    dashboard: {
      uid: dashboard.uid,
      title: dashboard.title,
      tags: Array.from<string>(dashboard.tags),
    },
    targets: panel.targets,
    scopedVars: panel.scopedVars,
    data: panel.getQueryRunner().getLastResult(),
  };
}
