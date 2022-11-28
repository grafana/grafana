export interface PageSwitcherProps<T> {
  values: Array<PageSwitcherValue<T>>;
  className?: string;
}

export interface PageSwitcherValue<T> {
  name: string;
  value: T;
  onChange?: () => void;
  label: string;
}
