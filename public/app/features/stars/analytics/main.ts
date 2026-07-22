import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { type ItemStarred } from './types';

/** @owner grafana-frontend-navigation */
const createStarsEvent = defineFeatureEvents('grafana', 'stars');

/** Fired when the user stars or unstars an item (dashboard or folder) via the star button. */
export const itemStarred = createStarsEvent<ItemStarred>('item_starred');
