import React, { FC } from 'react';

import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';
import { Icon } from '@grafana/ui';
import { getForcedLoginUrl } from './utils';

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
