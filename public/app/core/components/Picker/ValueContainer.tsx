import React from 'react';
import { components } from 'react-select';

export const ValueContainer = props => {
  const { children, getValue, options } = props;
  console.log('getValue', getValue());
  console.log('options', options);
  const existingValue = getValue();
  const selectedOption = options.find(i => (existingValue[0] ? i.id === existingValue[0].id : undefined));
  console.log('selectedOption', selectedOption);
  return (
    <components.ValueContainer {...props}>
      {children}
      {/* {selectedOption ?
            <span>{selectedOption.label}</span>
            : children} */}
    </components.ValueContainer>
  );
};

export default ValueContainer;
