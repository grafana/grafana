import { TextDimensionMode } from 'app/features/dimensions';
import { defaultStyleConfig, StyleConfig, StyleConfigFields, StyleConfigState } from './types';

/** Indicate if the style wants to show text values */
export function styleUsesText(config: StyleConfig): boolean {
  const { text } = config;
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
export function getStyleConfigState(config: StyleConfig): StyleConfigState {
  const hasText = styleUsesText(config);
  const state: StyleConfigState = {
    config,
    hasText,
    base: {
      color: config.color?.fixed ?? defaultStyleConfig.color.fixed,
    },
  };

  const fields: StyleConfigFields = {
    color: config.color?.field,
    size: config.size?.field,
    text: config.text?.field,
  };

  return fields;
}
