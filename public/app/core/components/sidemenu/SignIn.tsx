import React, { FC } from 'react';
import config from 'app/core/config';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';
import { Icon } from '@grafana/ui';

const getForcedLoginUrl = (url: string) => {
  const urlObj = new URL(url, config.appUrl);
  let params = urlObj.searchParams;
  params.set('forceLogin', 'true');
  return urlObj.toString();
};

export const SignIn: FC<any> = ({ url }) => {
  const forcedLoginUrl = getForcedLoginUrl(url);
  return (
    <div className="sidemenu-item">
      <a href={forcedLoginUrl} className="sidemenu-link" target="_self">
        <span className="icon-circle sidemenu-icon">
          <Icon name="sign-in-alt" size="xl" />
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

const mapStateToProps = (state: StoreState) => ({
  url: state.location.url,
});

export default connectWithStore(SignIn, mapStateToProps);
