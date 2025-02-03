import { createAction } from '@reduxjs/toolkit';

export const setFilteredMetricCount = createAction<number>('metrics-modal/setFilteredMetricCount');
