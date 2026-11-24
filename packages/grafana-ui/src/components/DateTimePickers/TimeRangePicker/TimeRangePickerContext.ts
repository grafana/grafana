import { createContext } from 'react';

import { type ExperimentalTimeRangePickerProps as TimeRangePickerProps } from '../TimeRangePicker';

/** Lets Grafana configure pickers rendered by Scenes without requiring a Scenes release. */
export const TimeRangePickerContext = createContext<NonNullable<TimeRangePickerProps['compactDesign']>>('legacy');
