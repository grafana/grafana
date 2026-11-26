import { components, type InputProps } from 'react-select';

import { pickDataAttributes } from '../../utils/dataAttributes';

/**
 * Custom input component for react-select to add data-testid and other data attributes
 */
export const CustomInput = (props: InputProps) => {
  let testId;

  if ('data-testid' in props.selectProps && props.selectProps['data-testid']) {
    testId = props.selectProps['data-testid'] + '-input';
  }

  return <components.Input {...props} {...pickDataAttributes(props.selectProps)} data-testid={testId} />;
};
