import { type PanelPlugin } from '@grafana/data';

/** A panel type the embed can render. */
export interface EmbedPanelType {
  /** Matches Dashboard v2 `spec.vizConfig.group`. */
  pluginId: string;
  /** Value defaults for panel `options`, standing in for the app's options builder. */
  optionDefaults: Record<string, unknown>;
  createPlugin: () => PanelPlugin;
}
