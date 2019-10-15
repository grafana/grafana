import { ReactElement } from 'react';

export interface SegmentProps<T> {
  onChange: (v: T | T[]) => void;
  value?: T | T[];
  Component?: ReactElement;
  className?: string;
  allowCustomValue?: boolean;
  isMulti?: boolean;
}
