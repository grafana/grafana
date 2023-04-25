export interface PageSwitcherProps<T> {
  values: Array<PageSwitcherValue<T>>;
  className?: string;
}

export interface PageSwitcherValue<T> {
  id: number;
  name: string;
  value: T;
  selected: boolean;
  onClick?: () => void;
  label: string;
  description: string;
}

export interface SelectedState {
  id: number;
  selected: boolean;
}
