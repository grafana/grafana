import React from 'react';
import DropDownChild from './DropDownChild';

interface SideMenuDropDownProps {
  link: any;
}

export default function SideMenuDropDown(props: SideMenuDropDownProps) {
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
}
