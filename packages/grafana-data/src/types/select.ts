/**
 * Used in select elements
 */
export interface SelectableValue<T = any> {
  label?: string;
  ariaLabel?: string;
  value?: T;
  imgUrl?: string;
  icon?: string;
  // Secondary text under the title of the option.
  description?: string;
  // Adds a simple native title attribute to each option.
  title?: string;
  // Optional component that will be shown together with other options. Does not get passed any props.
  component?: React.ComponentType;
  isDisabled?: boolean;
  // Optional data-testid attribute that will be added to the option element. If not provided, a default value will be generated based on the label or value.
  dataTestId?: string;
  [key: string]: any;
}
