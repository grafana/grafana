import React from 'react';

// Ignoring because I couldn't get @types/react-select work wih Torkel's fork
// @ts-ignore
import { components } from '@torkelo/react-select';

export const IndicatorsContainer = (props: any) => {
  const isOpen = props.selectProps.menuIsOpen;
  return (
    <components.IndicatorsContainer {...props}>
      <span
        className={`gf-form-select-box__select-arrow ${isOpen ? `gf-form-select-box__select-arrow--reversed` : ''}`}
      />
    </components.IndicatorsContainer>
  );
};

export default IndicatorsContainer;
