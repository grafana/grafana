/**
 * Used in select elements
 */
export interface SelectableValue<T = any> {
  label?: string;
  value?: T;
  imgUrl?: string;
  icon?: string;
  iconPlacement?: 'left' | 'right';
  description?: string;
  [key: string]: any;
}
