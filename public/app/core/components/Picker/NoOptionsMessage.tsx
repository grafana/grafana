import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

export interface Props {
  children: Element;
}

export const NoOptionsMessage = (props: OptionProps<any>) => {
  const { children } = props;
  return (
    <components.Option {...props}>
      <div className="gf-form-select-box__desc-option">
        <div className="gf-form-select-box__desc-option__body">{children}</div>
      </div>
    </components.Option>
  );
};

export default NoOptionsMessage;
