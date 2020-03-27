import React, { FC } from 'react';
import SideMenuDropDown from './SideMenuDropDown';
import { Icon, useTheme } from '@grafana/ui';

export interface Props {
  link: any;
}

const TopSectionItem: FC<Props> = props => {
  const { link } = props;
  const theme = useTheme();
  const iconColor = theme.isLight ? theme.colors.gray95 : theme.colors.gray4;
  return (
    <div className="sidemenu-item dropdown">
      <a className="sidemenu-link" href={link.url} target={link.target}>
        <span className="icon-circle sidemenu-icon">
          <Icon name={link.icon} size="xl" color={iconColor} />
          {link.img && <img src={link.img} />}
        </span>
      </a>
      <SideMenuDropDown link={link} />
    </div>
  );
};

export default TopSectionItem;
