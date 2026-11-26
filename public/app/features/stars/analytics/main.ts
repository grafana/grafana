import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { type ItemStarred } from './types';

/** @owner grafana-frontend-navigation */
const createStarsEvent = defineFeatureEvents('grafana', 'stars');

/** Fired when the user stars or unstars an item, with Grafana's star button or in a plugin through the stars service. */
export const itemStarred = createStarsEvent<ItemStarred>('item_starred');
