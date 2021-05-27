import React, { FC } from 'react';
import { filter } from 'lodash';
import DropDownChild from './DropDownChild';
import { NavModelItem } from '@grafana/data';
import { Link } from '@grafana/ui';

interface Props {
  link: NavModelItem;
  onHeaderClick?: () => void;
}

const SideMenuDropDown: FC<Props> = (props) => {
  const { link, onHeaderClick } = props;
  let childrenLinks: NavModelItem[] = [];
  if (link.children) {
    childrenLinks = filter(link.children, (item) => !item.hideFromMenu);
  }

  const linkContent = <span className="sidemenu-item-text">{link.text}</span>;
  const anchor = link.url ? (
    <Link href={link.url} onClick={onHeaderClick} className="side-menu-header-link">
      {linkContent}
    </Link>
  ) : (
    <a onClick={onHeaderClick} className="side-menu-header-link">
      {linkContent}
    </a>
  );

  return (
    <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
      <li className="side-menu-header">{anchor}</li>
      {childrenLinks.map((child, index) => {
        return <DropDownChild child={child} key={`${child.url}-${index}`} />;
      })}
    </ul>
  );
};

export default SideMenuDropDown;
