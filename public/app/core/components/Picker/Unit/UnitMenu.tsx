import React, { SFC } from 'react';
import { components } from 'react-select';
import { MenuProps } from 'react-select/lib/components/Menu';

interface ExtendedMenuProps extends MenuProps<any> {
  data: any;
}

const UnitMenu: SFC<ExtendedMenuProps> = props => {
  return (
    <components.Menu {...props}>
      <div>{props.children}</div>
    </components.Menu>
  );
};

export default UnitMenu;
