import React from 'react';
import { FieldConfigSource, PanelData } from '@grafana/data';

export interface PanelRendererProps<T = {}> {
  data: PanelData;
  pluginId: string;
  title: string;
  fieldConfig?: FieldConfigSource<T>;
  options?: Record<string, any>;
  width: number;
  height: number;
}

export type PanelRendererType<T = {}> = React.ComponentType<PanelRendererProps<T>>;

export let PanelRenderer: PanelRendererType = () => {
  return <div>PanelRenderer can only be used after Grafana instance has been started.</div>;
};

export function setPanelRenderer(renderer: PanelRendererType) {
  PanelRenderer = renderer;
}
