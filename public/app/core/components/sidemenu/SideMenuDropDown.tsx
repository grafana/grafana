import React from 'react';
import DropDownChild from './DropDownChild';
import { NavModelItem } from '@grafana/data';
import { IconName, Link } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  headerTarget?: HTMLAnchorElement['target'];
  headerText: string;
  headerUrl?: string;
  items?: NavModelItem[];
  onHeaderClick?: () => void;
  reverseDirection?: boolean;
  subtitleText?: string;
}

const SideMenuDropDown = ({
  headerTarget,
  headerText,
  headerUrl,
  items = [],
  onHeaderClick,
  reverseDirection = false,
  subtitleText,
}: Props) => {
  const headerContent = <span className="sidemenu-item-text">{headerText}</span>;
  let header = (
    <button onClick={onHeaderClick} className="side-menu-header-link">
      {headerContent}
    </button>
  );
  if (headerUrl) {
    header =
      !headerTarget && headerUrl.startsWith('/') ? (
        <Link href={headerUrl} onClick={onHeaderClick} className="side-menu-header-link">
          {headerContent}
        </Link>
      ) : (
        <a href={headerUrl} target={headerTarget} onClick={onHeaderClick} className="side-menu-header-link">
          {headerContent}
        </a>
      );
  }

  const menuClass = css`
    flex-direction: ${reverseDirection ? 'column-reverse' : 'column'};
  `;

  return (
    <ul className={`${menuClass} dropdown-menu dropdown-menu--sidemenu`} role="menu">
      <li className="side-menu-header">{header}</li>
      {items
        .filter((item) => !item.hideFromMenu)
        .map((child, index) => (
          <DropDownChild
            key={`${child.url}-${index}`}
            isDivider={child.divider}
            icon={child.icon as IconName}
            onClick={child.onClick}
            target={child.target}
            text={child.text}
            url={child.url}
          />
        ))}
      {subtitleText && (
        <li className="sidemenu-subtitle">
          <span className="sidemenu-item-text">{subtitleText}</span>
        </li>
      )}
    </ul>
  );
};

export default SideMenuDropDown;
