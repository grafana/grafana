import React, { FC, useCallback } from 'react';
import { MapDispatchToProps } from 'react-redux';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';
import { Icon } from '@grafana/ui';
import { updateLocation } from 'app/core/actions';

interface DispatchProps {
  updateLocation: typeof updateLocation;
}

export interface SignInPageProps {
  url: any;
  updateLocation: typeof updateLocation;
}

export type Props = SignInPageProps & DispatchProps;

export const SignIn: FC<SignInPageProps> = ({ url, updateLocation }) => {
  const onClick = useCallback(() => {
    updateLocation({
      path: url,
      query: { forceLogin: 'true' },
    });
  }, []);

  return (
    <div className="sidemenu-item">
      <a onClick={onClick} className="sidemenu-link" target="_self">
        <span className="icon-circle sidemenu-icon">
          <Icon name="sign-in-alt" size="xl" />
        </span>
      </a>
      <a onClick={onClick} target="_self">
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

const mapDispatchToProps: MapDispatchToProps<DispatchProps, SignInPageProps> = {
  updateLocation,
};

export default connectWithStore(SignIn, mapStateToProps, mapDispatchToProps);
