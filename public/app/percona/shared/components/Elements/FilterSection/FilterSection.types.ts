export interface FilterSectionProps<T> {
  onApply: (values: T) => void;
  className?: string;
  isOpen?: boolean;
}
