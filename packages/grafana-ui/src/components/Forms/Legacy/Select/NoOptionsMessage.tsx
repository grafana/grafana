import React from 'react';
import { components, OptionProps } from 'react-select';

export interface Props {
  children: Element;
}

export const NoOptionsMessage = (props: OptionProps<any, any>) => {
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
