import { FC, ReactElement, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { PanelMenuItem } from '@grafana/data';

import { DashboardModel, PanelModel } from '../../state';
import { StoreState } from '../../../../types';
import { getPanelMenu } from '../../utils/getPanelMenu';

interface PanelHeaderMenuProviderApi {
  items: PanelMenuItem[];
}

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  children: (props: PanelHeaderMenuProviderApi) => ReactElement;
}

export const PanelHeaderMenuProvider: FC<Props> = ({ panel, dashboard, children }) => {
  const [items, setItems] = useState<PanelMenuItem[]>([]);
  const angularComponent = useSelector(
    (state: StoreState) => state.dashboard.panels[panel.id]?.angularComponent || null
  );
  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, angularComponent));
  }, [dashboard, panel, angularComponent, setItems]);

  return children({ items });
};
