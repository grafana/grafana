import { SceneObject } from '@grafana/scenes';

export enum TabId {
  Queries = 'queries',
  Transformations = 'transformations',
  Alert = 'alert',
}

export interface PanelDataTabHeaderProps {
  active: boolean;
  onChangeTab?: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface PanelDataPaneTab extends SceneObject {
  renderTab: (props: PanelDataTabHeaderProps) => React.JSX.Element;
  getTabLabel(): string;
  tabId: TabId;
}
