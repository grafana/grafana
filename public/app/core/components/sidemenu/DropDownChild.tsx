import React, { FC } from 'react';
import { translate } from '../../../locale/translator';

export interface Props {
  child: any;
}

const DropDownChild: FC<Props> = props => {
  const { child } = props;
  const listItemClassName = child.divider ? 'divider' : '';

  return (
    <li className={listItemClassName}>
      <a href={child.url}>
        {child.icon && <i className={child.icon} />}
        {translate(child.text)}
      </a>
    </li>
  );
};

export default DropDownChild;
