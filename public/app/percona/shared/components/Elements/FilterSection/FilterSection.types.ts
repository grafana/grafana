import { PropsWithChildren } from 'react';

export interface FilterSectionProps<T> extends PropsWithChildren {
  onApply: (values: T) => void;
  className?: string;
  isOpen?: boolean;
}
