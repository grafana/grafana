import React from 'react';

import { AbsoluteTimeRange, FieldConfigSource, PanelData } from '@grafana/data';

/**
 * Describes the properties that can be passed to the PanelRenderer.
 *
 * @typeParam P - Panel options type for the panel being rendered.
 * @typeParam F - Field options type for the panel being rendered.
 *
 * @internal
 */
export interface PanelRendererProps<P extends object = any, F extends object = any> {
  data?: PanelData;
  pluginId: string;
  title: string;
  options?: Partial<P>;
  onOptionsChange?: (options: P) => void;
  onFieldConfigChange?: (config: FieldConfigSource<F>) => void;
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void;
  fieldConfig?: FieldConfigSource<Partial<F>>;
  timeZone?: string;
  width: number;
  height: number;
}

/**
 * Simplified type with defaults that describes the PanelRenderer.
 *
 * @internal
 */
export type PanelRendererType<P extends object = any, F extends object = any> = React.ComponentType<
  PanelRendererProps<P, F>
>;

/**
 * PanelRenderer component that will be set via the {@link setPanelRenderer} function
 * when Grafana starts. The implementation being used during runtime lives in Grafana
 * core.
 *
 * @internal
 */
export let PanelRenderer: PanelRendererType = () => {
  return <div>PanelRenderer can only be used after Grafana instance has been started.</div>;
};

/**
 * Used to bootstrap the PanelRenderer during application start so the PanelRenderer
 * is exposed via runtime.
 *
 * @internal
 */
export function setPanelRenderer(renderer: PanelRendererType) {
  PanelRenderer = renderer;
}
