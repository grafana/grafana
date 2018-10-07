import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

export interface Props {
  children: Element;
  isSelected: boolean;
  data: any;
  getStyles: any;
}

export const Option = (props: OptionProps<any>) => {
  const { children, isSelected, data } = props;
  return (
    <components.Option {...props}>
      <div className={`description-picker-option__button btn btn-link width-19`}>
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
