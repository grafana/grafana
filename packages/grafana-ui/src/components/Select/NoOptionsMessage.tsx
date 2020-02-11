import React from 'react';

// Ignoring because I couldn't get @types/react-select work wih Torkel's fork
// @ts-ignore
import { components } from '@torkelo/react-select';
// @ts-ignore
import { OptionProps } from '@torkelo/react-select/lib/components/Option';

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
