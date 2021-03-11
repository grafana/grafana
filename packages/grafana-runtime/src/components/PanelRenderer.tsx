import { FieldConfigSource, PanelData } from '@grafana/data';

export interface PanelRendererProps<T = {}> {
  data: PanelData;
  pluginId: string;
  fieldConfig?: FieldConfigSource<T>;
  options?: Record<string, any>;
  width: number;
  height: number;
}

export type PanelRendererType<T = {}> = React.ComponentType<PanelRendererProps<T>>;

export let PanelRenderer: PanelRendererType = () => {
  return null;
};

export function setPanelRenderer(comp: PanelRendererType) {
  PanelRenderer = comp;
}
