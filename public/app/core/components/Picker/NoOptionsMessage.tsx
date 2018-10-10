import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

export interface Props {
  children: Element;
}

export const PickerOption = (props: OptionProps<any>) => {
  const { children, className } = props;
  return (
    <components.Option {...props}>
      <div className={`description-picker-option__button btn btn-link ${className}`}>{children}</div>
    </components.Option>
  );
};

export default PickerOption;
