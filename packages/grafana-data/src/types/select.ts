/**
 * Used in select elements
 */
export interface SelectOptionItem<T = any> {
  label?: string;
  value?: T;
  imgUrl?: string;
  description?: string;
  [key: string]: any;
}
