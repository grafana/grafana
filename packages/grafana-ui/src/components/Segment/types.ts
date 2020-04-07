import { ReactElement } from 'react';

export interface SegmentProps<T> {
  Component?: ReactElement;
  className?: string;
  allowCustomValue?: boolean;
  placeholder?: string;
}
