/**
 * Used in select elements
 */
export interface SelectableValue<T = any> {
  label?: string;
  ariaLabel?: string;
  value?: T;
  imgUrl?: string;
  icon?: string;
  // Secondary text under the the title of the option.
  description?: string;
  // Adds a simple native title attribute to each option.
  title?: string;
  // Optional component that will be shown together with other options. Does not get past any props.
  component?: React.ComponentType;
  isDisabled?: boolean;
  [key: string]: any;
}
