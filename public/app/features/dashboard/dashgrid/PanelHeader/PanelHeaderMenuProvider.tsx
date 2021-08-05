import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { PanelMenuItem } from '@grafana/data';

import { DashboardModel, PanelModel } from '../../state';
import { StoreState } from '../../../../types';
import { getPanelMenu } from '../../utils/getPanelMenu';

export const usePanelMenuItems = (panel: PanelModel, dashboard: DashboardModel) => {
  const [items, setItems] = useState<PanelMenuItem[]>([]);
  const angularComponent = useSelector(
    (state: StoreState) => state.dashboard.panels[panel.id]?.angularComponent || null
  );
  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, angularComponent));
  }, [dashboard, panel, angularComponent, setItems]);

  return items;
};
