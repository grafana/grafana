import React, { FC } from 'react';

const SignIn: FC<any> = () => {
  const loginUrl = `login?redirect=${encodeURIComponent(window.location.pathname)}`;
  return (
    <div className="sidemenu-item">
      <a href={loginUrl} className="sidemenu-link" target="_self">
        <span className="icon-circle sidemenu-icon">
          <i className="fa fa-fw fa-sign-in" />
        </span>
      </a>
      <a href={loginUrl} target="_self">
        <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
          <li className="side-menu-header">
            <span className="sidemenu-item-text">Sign In</span>
          </li>
        </ul>
      </a>
    </div>
  );
};

export default SignIn;
