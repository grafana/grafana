import { type SettingsAccessSource } from '@grafana/runtime/internal';
import { defineFeatureEvents } from '@grafana/runtime/unstable';

/** @owner grafana-frontend-platform */
const createBootDataEvents = defineFeatureEvents('grafana', 'bootdata');

/** Fired periodically with how many times a bootdata setting was read since the previous flush. */
export const settingAccessed = createBootDataEvents<{ path: string; source: SettingsAccessSource; count: number }>(
  'setting_accessed'
);
