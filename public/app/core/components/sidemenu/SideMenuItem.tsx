import React, { ReactNode } from 'react';
import SideMenuDropDown from './SideMenuDropDown';
import { Link } from '@grafana/ui';
import { NavModelItem } from '@grafana/data';
import { cx } from '@emotion/css';

export interface Props {
  children: ReactNode;
  label: string;
  menuItems?: NavModelItem[];
  menuSubTitle?: string;
  onClick?: () => void;
  reverseMenuDirection?: boolean;
  target?: HTMLAnchorElement['target'];
  url?: string;
}

const SideMenuItem = ({
  children,
  label,
  menuItems = [],
  menuSubTitle,
  onClick,
  reverseMenuDirection = false,
  target,
  url,
}: Props) => {
  const anchor = url ? (
    <Link
      className="sidemenu-link"
      href={url}
      target={target}
      aria-label={label}
      onClick={onClick}
      aria-haspopup="true"
    >
      <span className="icon-circle sidemenu-icon">{children}</span>
    </Link>
  ) : (
    <button className="sidemenu-link" onClick={onClick} aria-label={label}>
      <span className="icon-circle sidemenu-icon">{children}</span>
    </button>
  );

  return (
    <div className={cx('sidemenu-item', 'dropdown', { dropup: reverseMenuDirection })}>
      {anchor}
      <SideMenuDropDown
        headerText={label}
        headerUrl={url}
        items={menuItems}
        onHeaderClick={onClick}
        reverseDirection={reverseMenuDirection}
        subtitleText={menuSubTitle}
      />
    </div>
  );
};

export default SideMenuItem;
