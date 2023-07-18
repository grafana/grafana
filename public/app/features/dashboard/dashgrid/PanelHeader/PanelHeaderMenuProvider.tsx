import { ReactElement, useEffect, useState } from 'react';

import { LoadingState, PanelMenuItem } from '@grafana/data';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { useSelector } from 'app/types';

import { usePanelLatestData } from '../../components/PanelEditor/usePanelLatestData';
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
  // GO ALL THE WAY BACK HERE FOR HOOKS?!?!
  const dataOptions = {
    withTransforms: false,
    withFieldConfig: true,
  };
  const [items, setItems] = useState<PanelMenuItem[]>([]);
  const angularComponent = useSelector((state) => getPanelStateForModel(state, panel)?.angularComponent);
  const { data } = usePanelLatestData(panel, dataOptions);
  console.log('data', data);

  useEffect(() => {
    setItems(getPanelMenu(dashboard, panel, angularComponent, data));
  }, [dashboard, panel, angularComponent, data, loadingState, setItems]);

  return children({ items });
}
