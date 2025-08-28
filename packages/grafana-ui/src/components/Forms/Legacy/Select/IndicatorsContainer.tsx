import { components, IndicatorsContainerProps } from 'react-select';

import { SelectableValue } from '@grafana/data';

import { Icon } from '../../../Icon/Icon';
import { Select } from '../../../Select/Select';

/** @deprecated Please use the Combobox component instead */
export const IndicatorsContainer = <T,>(props: IndicatorsContainerProps<SelectableValue<T>>) => {
  const isOpen = props.selectProps.menuIsOpen;
  return (
    <components.IndicatorsContainer {...props}>
      <Icon name={isOpen ? 'angle-up' : 'angle-down'} style={{ marginTop: '7px' }} />
    </components.IndicatorsContainer>
  );
};

export default IndicatorsContainer;
