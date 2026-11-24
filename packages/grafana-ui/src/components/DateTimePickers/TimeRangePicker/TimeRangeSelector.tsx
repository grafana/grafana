import { type ComponentProps } from 'react';

import { getQuickOptions } from '../options';

import { TimePickerContent } from './TimePickerContent';

export type TimeRangeSelectorProps = ComponentProps<typeof TimePickerContent>;

export function TimeRangeSelector({ quickOptions = getQuickOptions(), ...props }: TimeRangeSelectorProps) {
  return <TimePickerContent {...props} quickOptions={quickOptions} />;
}
