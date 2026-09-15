import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { type TextPanelSavedProperties } from './types';

/** @owner dataviz-squad */
const createTextPanelEvent = defineFeatureEvents('grafana', 'text_panel');

export const TextPanelInteractions = {
  /** Fired on dashboard save, once per text panel the author edited. Discarded configs are never reported. */
  saved: createTextPanelEvent<TextPanelSavedProperties>('saved'),
};
