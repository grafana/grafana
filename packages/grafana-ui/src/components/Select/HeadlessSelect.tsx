import React, { FunctionComponent } from 'react';
import Select, { CommonProps, SelectProps } from './Select';

export const HeadlessSelect: FunctionComponent<CommonProps & SelectProps> = props => (
  <div className="headless-select">
    <Select {...props} />
  </div>
);
