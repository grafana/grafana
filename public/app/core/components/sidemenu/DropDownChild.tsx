import React, { SFC } from 'react';

interface DropDownChildProps {
  child: any;
}

const DropDownChild: SFC<DropDownChildProps> = props => {
  const { child } = props;
  const listItemClassName = child.divider ? 'divider' : '';

  return (
    <li className={listItemClassName}>
      <a href={child.url}>
        {child.icon && <i className={child.icon} />}
        {child.text}
      </a>
    </li>
  );
};

export default DropDownChild;
