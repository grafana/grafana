import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

export interface Props {
  children: Element;
  isSelected: boolean;
  data: any;
  getStyles: any;
  className?: string;
}

export const PickerOption = (props: OptionProps<any>) => {
  const { children, data } = props;
  return (
    <components.Option {...props}>
      <div className={`description-picker-option__button btn btn-link width-19`}>
        <img src={data.avatarUrl} alt={data.label} className="user-picker-option__avatar" />
        {children}
      </div>
    </components.Option>
  );
};

export default PickerOption;
