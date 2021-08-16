import React, { FC } from 'react';
import SideMenuDropDown from './SideMenuDropDown';
import { Icon, Link } from '@grafana/ui';
import { NavModelItem } from '@grafana/data';

export interface Props {
  link: NavModelItem;
  onClick?: () => void;
}

const TopSectionItem: FC<Props> = ({ link, onClick }) => {
  const linkContent = (
    <span className="icon-circle sidemenu-icon">
      {link.icon && <Icon name={link.icon as any} size="xl" />}
      {link.img && <img src={link.img} />}
    </span>
  );

  const anchor = link.url ? (
    <Link
      className="sidemenu-link"
      href={link.url}
      target={link.target}
      aria-label={link.text}
      onClick={onClick}
      aria-haspopup="true"
    >
      {linkContent}
    </Link>
  ) : (
    <a className="sidemenu-link" onClick={onClick} aria-label={link.text}>
      {linkContent}
    </a>
  );
  return (
    <div className="sidemenu-item dropdown">
      {anchor}
      <SideMenuDropDown link={link} onHeaderClick={onClick} />
    </div>
  );
};

export default TopSectionItem;
