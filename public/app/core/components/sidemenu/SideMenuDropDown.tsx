import React, { FC } from 'react';
import DropDownChild from './DropDownChild';
import { NavModelItem } from '@grafana/data';

interface Props {
  link: NavModelItem;
}

const SideMenuDropDown: FC<Props> = props => {
  const { link } = props;
  return (
    <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
      <li className="side-menu-header">
        <a className="side-menu-header-link" href={link.url}>
          <span className="sidemenu-item-text">{link.text}</span>
        </a>
      </li>
      {link.children &&
        link.children.map((child, index) => {
          return <DropDownChild child={child} key={`${child.url}-${index}`} />;
        })}
    </ul>
  );
};

export default SideMenuDropDown;
