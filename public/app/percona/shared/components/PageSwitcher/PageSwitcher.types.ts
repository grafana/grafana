export interface PageSwitcherProps {
  values: Array<PageSwitcherValue<any>>;
  className?: string;
}

export interface PageSwitcherValue<T> {
  name: string;
  value: T;
  onChange?: () => void;
  label: string;
}
