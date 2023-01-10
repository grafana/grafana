import { ReactElement, useEffect, useState } from 'react';

import { PanelMenuItem } from '@grafana/data';
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
  isStreaming?: boolean;
  children: (props: PanelHeaderMenuProviderApi) => ReactElement;
}

export function PanelHeaderMenuProvider({ panel, dashboard, isStreaming, children }: Props) {
  const [items, setItems] = useState<PanelMenuItem[]>([]);
  const angularComponent = useSelector((state) => getPanelStateForModel(state, panel)?.angularComponent);

  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, isStreaming, angularComponent));
  }, [dashboard, panel, angularComponent, isStreaming, setItems]);

  return children({ items });
}
