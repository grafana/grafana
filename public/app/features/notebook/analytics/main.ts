import { defineFeatureEvents } from '@grafana/runtime/unstable';

/** @owner sharing-squad */
export const createNotebookEvent = defineFeatureEvents('grafana', 'notebook');
