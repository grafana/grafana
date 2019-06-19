import React from 'react';
import _ from 'lodash';
import SignIn from './SignIn';
import BottomNavLinks from './BottomNavLinks';
import { contextSrv } from 'app/core/services/context_srv';
import config from '../../config';
import { NavModelItem } from '@grafana/data';

export default function BottomSection() {
  const navTree: NavModelItem[] = _.cloneDeep(config.bootData.navTree);
  const bottomNav: NavModelItem[] = _.filter(navTree, item => item.hideFromMenu);
  const isSignedIn = contextSrv.isSignedIn;
  const user = contextSrv.user;

  if (user && user.orgCount > 1) {
    const profileNode: any = _.find(bottomNav, { id: 'profile' });
    if (profileNode) {
      profileNode.showOrgSwitcher = true;
    }
  }

  return (
    <div className="sidemenu__bottom">
      {!isSignedIn && <SignIn />}
      {bottomNav.map((link, index) => {
        return <BottomNavLinks link={link} user={user} key={`${link.url}-${index}`} />;
      })}
    </div>
  );
}
