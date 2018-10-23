import React, { SFC } from 'react';
import DropDownChild from './DropDownChild';

interface Props {
  link: any;
}

const SideMenuDropDown: SFC<Props> = props => {
  const { link } = props;
  return (
    <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
      <li className="side-menu-header">
        <span className="sidemenu-item-text">{link.text}</span>
      </li>
      {link.children &&
        link.children.map((child, index) => {
          return <DropDownChild child={child} key={`${child.url}-${index}`} />;
        })}
    </ul>
  );
};

export default SideMenuDropDown;
