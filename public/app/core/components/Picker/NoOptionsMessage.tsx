import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

export interface Props {
  children: Element;
}

export const PickerOption = (props: OptionProps<any>) => {
  const { children } = props;
  return (
    <components.Option {...props}>
      <div className={`description-picker-option__button btn btn-link width-19`}>{children}</div>
    </components.Option>
  );
};

export default PickerOption;
