import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { type LanguageChanged, type SaveButtonClicked, type ThemeChanged } from './types';

/** @owner grafana-frontend-platform */
const createSharedPreferencesEvents = defineFeatureEvents('grafana', 'preferences');

/** Fired when the user clicks the Save button on the preferences form. */
export const saveButtonClicked = createSharedPreferencesEvents<SaveButtonClicked>('save_button_clicked');

/** Fired immediately when the user selects a new theme from the theme picker, before saving. */
export const themeChanged = createSharedPreferencesEvents<ThemeChanged>('theme_changed');

/** Fired immediately when the user selects a new language from the language picker, before saving. */
export const languageChanged = createSharedPreferencesEvents<LanguageChanged>('language_changed');
