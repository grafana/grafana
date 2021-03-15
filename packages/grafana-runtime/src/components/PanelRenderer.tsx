import React from 'react';
import { AbsoluteTimeRange, FieldConfigSource, PanelData } from '@grafana/data';

export interface PanelRendererProps<T extends object = any> {
  data: PanelData;
  pluginId: string;
  title: string;
  fieldConfig?: FieldConfigSource<T>;
  options?: T;
  onOptionsChange: (options: T) => void;
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void;
  timeZone?: string;
  width: number;
  height: number;
}

export type PanelRendererType<T extends object = any> = React.ComponentType<PanelRendererProps<T>>;

export let PanelRenderer: PanelRendererType = () => {
  return <div>PanelRenderer can only be used after Grafana instance has been started.</div>;
};

export function setPanelRenderer(renderer: PanelRendererType) {
  PanelRenderer = renderer;
}
