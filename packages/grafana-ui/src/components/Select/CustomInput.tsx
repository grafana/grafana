import { components, InputProps } from 'react-select';

/**
 * Custom input component for react-select to add data-testid attribute
 */
export const CustomInput = (props: InputProps) => {
  let testId;

  if ('data-testid' in props.selectProps && props.selectProps['data-testid']) {
    testId = props.selectProps['data-testid'] + '-input';
  }

  return <components.Input {...props} data-testid={testId} />;
};
