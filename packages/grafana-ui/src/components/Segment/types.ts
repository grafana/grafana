import { ReactElement } from 'react';
import { SelectableValue } from '@grafana/data';

export interface SegmentProps<T> {
  onChange: (item: SelectableValue<T>) => void;
  value?: SelectableValue<T>;
  Component?: ReactElement;
  className?: string;
  allowCustomValue?: boolean;
}
