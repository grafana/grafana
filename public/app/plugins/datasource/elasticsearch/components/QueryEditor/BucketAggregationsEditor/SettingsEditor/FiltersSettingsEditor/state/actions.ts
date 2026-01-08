import { createAction } from '@reduxjs/toolkit';

import { Filter } from 'app/plugins/datasource/elasticsearch/dataquery.gen';

export const addFilter = createAction('@bucketAggregations/filter/add');
export const removeFilter = createAction<number>('@bucketAggregations/filter/remove');
export const changeFilter = createAction<{ index: number; filter: Filter }>('@bucketAggregations/filter/change');
