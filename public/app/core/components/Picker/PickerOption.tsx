import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

// https://github.com/JedWatson/react-select/issues/3038
interface ExtendedOptionProps extends OptionProps<any> {
  data: any;
}

export const PickerOption = (props: ExtendedOptionProps) => {
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
