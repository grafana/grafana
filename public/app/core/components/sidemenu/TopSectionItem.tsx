import React, { SFC } from 'react';
import SideMenuDropDown from './SideMenuDropDown';

interface TopSectionItemProps {
  link: any;
}

const TopSectionItem: SFC<TopSectionItemProps> = props => {
  const { link } = props;
  return (
    <div className="sidemenu-item dropdown">
      <a className="sidemenu-link" href={link.url} target={link.target}>
        <span className="icon-circle sidemenu-icon">
          <i className={link.icon} />
          {link.img && <img src={link.img} />}
        </span>
      </a>
      {link.children && <SideMenuDropDown link={link} />}
    </div>
  );
};

export default TopSectionItem;
