import React from 'react';
import DropDownChild from './DropDownChild';
import { NavModelItem } from '@grafana/data';
import { IconName, Link } from '@grafana/ui';

interface Props {
  items?: NavModelItem[];
  headerText: string;
  headerUrl?: string;
  onHeaderClick?: () => void;
}

const SideMenuDropDown = ({ items = [], headerText, headerUrl, onHeaderClick }: Props) => {
  const headerContent = <span className="sidemenu-item-text">{headerText}</span>;
  const header = headerUrl ? (
    <Link href={headerUrl} onClick={onHeaderClick} className="side-menu-header-link">
      {headerContent}
    </Link>
  ) : (
    <a onClick={onHeaderClick} className="side-menu-header-link">
      {headerContent}
    </a>
  );

  return (
    <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
      <li className="side-menu-header">{header}</li>
      {items
        .filter((item) => !item.hideFromMenu)
        .map((child, index) => (
          <DropDownChild
            key={`${child.url}-${index}`}
            isDivider={child.divider}
            icon={child.icon as IconName}
            text={child.text}
            url={child.url}
          />
        ))}
    </ul>
  );
};

export default SideMenuDropDown;
