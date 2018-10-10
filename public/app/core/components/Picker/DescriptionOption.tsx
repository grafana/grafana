import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

// https://github.com/JedWatson/react-select/issues/3038
interface ExtendedOptionProps extends OptionProps<any> {
  data: any;
}

export const Option = (props: ExtendedOptionProps) => {
  const { children, isSelected, data, className } = props;
  return (
    <components.Option {...props}>
      <div className={`description-picker-option__button btn btn-link ${className}`}>
        {isSelected && <i className="fa fa-check pull-right" aria-hidden="true" />}
        <div className="gf-form">{children}</div>
        <div className="gf-form">
          <div className="muted width-17">{data.description}</div>
        </div>
      </div>
    </components.Option>
  );
};

export default Option;
