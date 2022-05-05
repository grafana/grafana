import { FC, ReactElement, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { PanelMenuItem } from '@grafana/data';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';

import { StoreState } from '../../../../types';
import { DashboardModel, PanelModel } from '../../state';
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
  const angularComponent = useSelector((state: StoreState) => getPanelStateForModel(state, panel)?.angularComponent);

  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, angularComponent));
  }, [dashboard, panel, angularComponent, setItems]);

  return children({ items });
};
