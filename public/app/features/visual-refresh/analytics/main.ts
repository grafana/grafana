import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { type StylesToggled } from './types';

/** @owner grafana-frontend-platform */
const createVisualRefreshEvent = defineFeatureEvents('grafana', 'visual_refresh');

/** Fired when the user applies or reverts the visual design refresh from the preferences alert. */
export const stylesToggled = createVisualRefreshEvent<StylesToggled>('styles_toggled');
