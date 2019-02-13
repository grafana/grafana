import React, { FunctionComponent } from 'react';
import Select, { CommonProps, SelectProps } from './Select';

export const HeadlessSelect: FunctionComponent<CommonProps & SelectProps> = props => {
  const { autoFocus, backspaceRemovesValue, isClearable, isSearchable, ...rest } = props;
  return (
    <div className="headless-select">
      <Select autoFocus backspaceRemovesValue={false} isClearable={false} isSearchable={false} {...rest} />
    </div>
  );
};
