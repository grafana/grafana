import { ReactElement, useCallback, useEffect, useState } from 'react';

import { LoadingState, PanelMenuItem } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { useSelector } from 'app/types';

import { DashboardModel, PanelModel } from '../../state';
import { getPanelMenu } from '../../utils/getPanelMenu';

interface PanelHeaderMenuProviderApi {
  items: PanelMenuItem[];
  reportMenuInteraction: () => void;
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

  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, angularComponent));
  }, [dashboard, panel, angularComponent, loadingState, setItems]);

  const reportMenuInteraction = useCallback(() => {
    // Report menu interaction only when there are items being rendered
    if (items.length > 0) {
      reportInteraction('dashboards_panelheader_menu', { item: 'menu' });
    }
  }, [items]);

  return children({ items, reportMenuInteraction });
}
