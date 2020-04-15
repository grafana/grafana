import React, { FC } from 'react';
import SideMenuDropDown from './SideMenuDropDown';
import { Icon } from '@grafana/ui';

export interface Props {
  link: any;
}

const TopSectionItem: FC<Props> = props => {
  const { link } = props;
  return (
    <div className="sidemenu-item dropdown">
      <a className="sidemenu-link" href={link.url} target={link.target}>
        <span className="icon-circle sidemenu-icon">
          <Icon name={link.icon} size="xl" />
          {link.img && <img src={link.img} />}
        </span>
      </a>
      <SideMenuDropDown link={link} />
    </div>
  );
};

export default TopSectionItem;
