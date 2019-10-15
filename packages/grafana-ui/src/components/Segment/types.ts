import { ReactElement } from 'react';

export interface SegmentProps<T> {
  onChange: (item: T) => void;
  value?: T;
  Component?: ReactElement;
  className?: string;
  allowCustomValue?: boolean;
}
