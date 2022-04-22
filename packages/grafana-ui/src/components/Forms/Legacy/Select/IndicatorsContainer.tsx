import React from 'react';
import { components } from 'react-select';

import { Icon } from '../../../Icon/Icon';

export const IndicatorsContainer = (props: any) => {
  const isOpen = props.selectProps.menuIsOpen;
  return (
    <components.IndicatorsContainer {...props}>
      <Icon name={isOpen ? 'angle-up' : 'angle-down'} style={{ marginTop: '7px' }} />
    </components.IndicatorsContainer>
  );
};

export default IndicatorsContainer;
