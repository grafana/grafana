import { config } from '@grafana/runtime';
import { TextDimensionMode } from '@grafana/schema';

import { getMarkerMaker } from './markers';
import { defaultStyleConfig, StyleConfig, StyleConfigFields, StyleConfigState } from './types';

/** Indicate if the style wants to show text values */
export function styleUsesText(config: StyleConfig): boolean {
  const text = config?.text;
  if (!text) {
    return false;
  }
  if (text.mode === TextDimensionMode.Fixed && text.fixed?.length) {
    return true;
  }
  if (text.mode === TextDimensionMode.Field && text.field?.length) {
    return true;
  }
  return false;
}

/** Return a distinct list of fields used to dynamically change the style */
export async function getStyleConfigState(cfg?: StyleConfig): Promise<StyleConfigState> {
  if (!cfg) {
    cfg = defaultStyleConfig;
  }
  const hasText = styleUsesText(cfg);
  const fields: StyleConfigFields = {};
  const maker = await getMarkerMaker(cfg.symbol?.fixed, hasText);
  const state: StyleConfigState = {
    config: cfg, // raw values
    hasText,
    fields,
    base: {
      color: config.theme2.visualization.getColorByName(cfg.color?.fixed ?? defaultStyleConfig.color.fixed),
      opacity: cfg.opacity ?? defaultStyleConfig.opacity,
      lineWidth: cfg.lineWidth ?? 1,
      size: cfg.size?.fixed ?? defaultStyleConfig.size.fixed,
      rotation: cfg.rotation?.fixed ?? defaultStyleConfig.rotation.fixed, // add ability follow path later
    },
    maker,
  };

  if (cfg.color?.field?.length) {
    fields.color = cfg.color.field;
  }
  if (cfg.size?.field?.length) {
    fields.size = cfg.size.field;
  }
  if (cfg.rotation?.field?.length) {
    fields.rotation = cfg.rotation.field;
  }

  if (hasText) {
    state.base.text = cfg.text?.fixed;
    state.base.textConfig = cfg.textConfig ?? defaultStyleConfig.textConfig;

    if (cfg.text?.field?.length) {
      fields.text = cfg.text.field;
    }
  }

  // Clear the fields if possible
  if (!Object.keys(fields).length) {
    state.fields = undefined;
  }
  return state;
}
