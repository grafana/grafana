import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import appEvents from '../../app_events';
import { User } from '../../services/context_srv';
import { NavModelItem } from '@grafana/data';
import { Icon, IconName, Link } from '@grafana/ui';
import { OrgSwitcher } from '../OrgSwitcher';
import { getFooterLinks } from '../Footer/Footer';
import { ShowModalReactEvent } from '../../../types/events';
import { HelpModal } from '../help/HelpModal';

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
    const subMenuIconClassName = css`
      margin-right: 8px;
    `;

    let children = link.children || [];

    if (link.id === 'help') {
      children = getFooterLinks();
    }

    return (
      <div className="sidemenu-item dropdown dropup">
        <Link href={link.url} className="sidemenu-link" target={link.target}>
          <span className="icon-circle sidemenu-icon">
            {link.icon && <Icon name={link.icon as IconName} size="xl" title="Help icon" />}
            {link.img && <img src={link.img} alt="Profile picture" />}
          </span>
        </Link>
        <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
          {link.subTitle && (
            <li className="sidemenu-subtitle">
              <span className="sidemenu-item-text">{link.subTitle}</span>
            </li>
          )}
          {link.showOrgSwitcher && (
            <li className="sidemenu-org-switcher">
              <a onClick={this.toggleSwitcherModal}>
                <div>
                  <div className="sidemenu-org-switcher__org-current">Current Org.:</div>
                  <div className="sidemenu-org-switcher__org-name">{user.orgName}</div>
                </div>
                <div className="sidemenu-org-switcher__switch">
                  <Icon name="arrow-random" className={subMenuIconClassName} />
                  Switch
                </div>
              </a>
            </li>
          )}

          {showSwitcherModal && <OrgSwitcher onDismiss={this.toggleSwitcherModal} />}

          {children.map((child, index) => {
            return (
              <li key={`${child.text}-${index}`}>
                <a href={child.url} target={child.target} rel="noopener">
                  {child.icon && <Icon name={child.icon as IconName} className={subMenuIconClassName} />}
                  {child.text}
                </a>
              </li>
            );
          })}

          {link.id === 'help' && (
            <li key="keyboard-shortcuts">
              <a onClick={() => this.onOpenShortcuts()}>
                <Icon name="keyboard" className={subMenuIconClassName} /> Keyboard shortcuts
              </a>
            </li>
          )}

          <li className="side-menu-header">
            <span className="sidemenu-item-text">{link.text}</span>
          </li>
        </ul>
      </div>
    );
  }
}
