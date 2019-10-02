import React, { FC } from 'react';
import SideMenuDropDown from './SideMenuDropDown';

export interface Props {
  link: any;
}

const TopSectionItem: FC<Props> = props => {
  const { link } = props;
  return (
    <div className="sidemenu-item dropdown">
      <a className="sidemenu-link" href={link.url} target={link.target}>
        <span className="icon-circle sidemenu-icon">
          <i className={link.icon} />
          {link.img && <img src={link.img} />}
        </span>
      </a>
      <SideMenuDropDown link={link} />
    </div>
  );
};

export default TopSectionItem;
