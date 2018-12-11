import React from 'react';
import { components } from 'react-select';

export const GroupHeading = props => {
  return (
    <label className="description-picker-option__button btn picker-option-group">
      <components.GroupHeading {...props} />
    </label>
  );
};

export default GroupHeading;
