import React, { FC } from 'react';
import { Unicon } from '@grafana/ui/src/components/Icon/Unicon';

export interface Props {
  child: any;
}

const DropDownChild: FC<Props> = props => {
  const { child } = props;
  const listItemClassName = child.divider ? 'divider' : '';

  return (
    <li className={listItemClassName}>
      <a href={child.url}>
        {child.icon && <Unicon name={child.icon} />}
        {child.text}
      </a>
    </li>
  );
};

export default DropDownChild;
