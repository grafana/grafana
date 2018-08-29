import React from 'react';

export default function SideMenuTop({ mainLinks }) {
  return (
    <div className="sidemenu__top">
      {mainLinks.map((link, index) => {
        return (
          <a className="sidemenu-link" href={link.url} target={link.target} key={`${link.id}-${index}`}>
            <span className="icon-circle sidemenu-icon">
              <i className={link.icon} />
              {link.img && <img src={link.img} />}
            </span>
          </a>
        );
      })}
    </div>
  );
}
