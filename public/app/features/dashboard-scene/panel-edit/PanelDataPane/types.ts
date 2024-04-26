import { SceneObject, SceneObjectState } from '@grafana/scenes';

export interface PanelDataPaneTabState extends SceneObjectState {}

export enum TabId {
  Queries = 'queries',
  Transformations = 'transformations',
  Alert = 'alert',
}

export interface PanelDataTabHeaderProps {
  key: string;
  active: boolean;
  onChangeTab?: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface PanelDataPaneTab extends SceneObject {
  TabComponent: (props: PanelDataTabHeaderProps) => React.JSX.Element;
  getTabLabel(): string;
  tabId: TabId;
}
