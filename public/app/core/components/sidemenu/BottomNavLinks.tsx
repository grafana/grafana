import React, { PureComponent } from 'react';
import appEvents from '../../app_events';
import { User } from '../../services/context_srv';
import { NavModelItem } from '@grafana/data';
import { Icon, IconName, Link } from '@grafana/ui';
import { OrgSwitcher } from '../OrgSwitcher';
import { getFooterLinks } from '../Footer/Footer';
import { ShowModalReactEvent } from '../../../types/events';
import { HelpModal } from '../help/HelpModal';
import SideMenuDropDown from './SideMenuDropDown';

export interface Props {
  link: NavModelItem;
  user: User;
}

interface State {
  showSwitcherModal: boolean;
}

export default class BottomNavLinks extends PureComponent<Props, State> {
  state: State = {
    showSwitcherModal: false,
  };

  onOpenShortcuts = () => {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  };

  toggleSwitcherModal = () => {
    this.setState((prevState) => ({
      showSwitcherModal: !prevState.showSwitcherModal,
    }));
  };

  render() {
    const { link, user } = this.props;
    const { showSwitcherModal } = this.state;

    let children = link.children || [];

    if (link.id === 'help') {
      children = [
        ...getFooterLinks(),
        {
          text: 'Keyboard shortcuts',
          icon: 'keyboard',
          onClick: this.onOpenShortcuts,
        },
      ];
    }

    if (link.showOrgSwitcher) {
      children = [
        ...children,
        {
          text: 'Switch organization',
          icon: 'arrow-random',
          onClick: this.toggleSwitcherModal,
        },
      ];
    }

    return (
      <div className="sidemenu-item dropdown dropup">
        <Link href={link.url} className="sidemenu-link" target={link.target}>
          <span className="icon-circle sidemenu-icon">
            {link.icon && <Icon name={link.icon as IconName} size="xl" title="Help icon" />}
            {link.img && <img src={link.img} alt="Profile picture" />}
          </span>
        </Link>
        <SideMenuDropDown
          headerText={link.text}
          headerUrl={link.url}
          items={children}
          reverseDirection
          subtitleText={link.showOrgSwitcher ? `Current Org.: ${user.orgName}` : link.subTitle}
        />
        {showSwitcherModal && <OrgSwitcher onDismiss={this.toggleSwitcherModal} />}
      </div>
    );
  }
}
