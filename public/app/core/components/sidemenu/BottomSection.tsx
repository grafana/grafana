import React, { useState } from 'react';
import { cloneDeep } from 'lodash';
import { NavModelItem } from '@grafana/data';
import { Icon, IconName } from '@grafana/ui';
import appEvents from '../../app_events';
import { SignIn } from './SignIn';
import SideMenuItem from './SideMenuItem';
import { ShowModalReactEvent } from '../../../types/events';
import { contextSrv } from 'app/core/services/context_srv';
import { OrgSwitcher } from '../OrgSwitcher';
import { getFooterLinks } from '../Footer/Footer';
import { HelpModal } from '../help/HelpModal';
import config from '../../config';

export default function BottomSection() {
  const navTree: NavModelItem[] = cloneDeep(config.bootData.navTree);
  const bottomNav = navTree.filter((item) => item.hideFromMenu);
  const isSignedIn = contextSrv.isSignedIn;
  const user = contextSrv.user;
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);

  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };

  const onOpenShortcuts = () => {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  };

  if (user && user.orgCount > 1) {
    const profileNode = bottomNav.find((bottomNavItem) => bottomNavItem.id === 'profile');
    if (profileNode) {
      profileNode.showOrgSwitcher = true;
      profileNode.subTitle = `Current Org.: ${user?.orgName}`;
    }
  }

  return (
    <div data-testid="bottom-section-items" className="sidemenu__bottom">
      {!isSignedIn && <SignIn />}
      {bottomNav.map((link, index) => {
        let menuItems = link.children || [];

        if (link.id === 'help') {
          menuItems = [
            ...getFooterLinks(),
            {
              text: 'Keyboard shortcuts',
              icon: 'keyboard',
              onClick: onOpenShortcuts,
            },
          ];
        }

        if (link.showOrgSwitcher) {
          menuItems = [
            ...menuItems,
            {
              text: 'Switch organization',
              icon: 'arrow-random',
              onClick: toggleSwitcherModal,
            },
          ];
        }

        return (
          <SideMenuItem
            key={`${link.url}-${index}`}
            label={link.text}
            menuItems={menuItems}
            menuSubTitle={link.subTitle}
            onClick={link.onClick}
            reverseMenuDirection
            target={link.target}
            url={link.url}
          >
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </SideMenuItem>
        );
      })}
      {showSwitcherModal && <OrgSwitcher onDismiss={toggleSwitcherModal} />}
    </div>
  );
}
