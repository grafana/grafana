import React, { FC } from 'react';
import { Icon } from '@grafana/ui';
import { useLocation } from 'react-router-dom';
import { getForcedLoginUrl } from './utils';

export const SignIn: FC<any> = () => {
  const location = useLocation();
  const forcedLoginUrl = getForcedLoginUrl(location.pathname + location.search);

  return (
    <div className="sidemenu-item">
      <a href={forcedLoginUrl} className="sidemenu-link" target="_self">
        <span className="icon-circle sidemenu-icon">
          <Icon name="signout" size="xl" />
        </span>
      </a>
      <a href={forcedLoginUrl} target="_self">
        <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
          <li className="side-menu-header">
            <span className="sidemenu-item-text">Sign In</span>
          </li>
        </ul>
      </a>
    </div>
  );
};
