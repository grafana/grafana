import { DataTransformerConfig } from '@grafana/data';
import { SceneDataQuery, SceneObject } from '@grafana/scenes';

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

interface QueryTransformItemBase {
  id: string;
  index: number;
}

export interface QueryItem extends QueryTransformItemBase {
  type: 'query' | 'expression';
  data: SceneDataQuery;
}

export interface TransformItem extends QueryTransformItemBase {
  type: 'transform';
  data: DataTransformerConfig;
}

export type QueryTransformItem = QueryItem | TransformItem;
