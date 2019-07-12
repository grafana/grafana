import React, { PureComponent } from 'react';
import appEvents from '../../app_events';
import { User } from '../../services/context_srv';
import { NavModelItem } from '@grafana/data';

export interface Props {
  link: NavModelItem;
  user: User;
}

class BottomNavLinks extends PureComponent<Props> {
  itemClicked = (event: React.SyntheticEvent, child: NavModelItem) => {
    if (child.url === '/shortcuts') {
      event.preventDefault();
      appEvents.emit('show-modal', {
        templateHtml: '<help-modal></help-modal>',
      });
    }
  };

  switchOrg = () => {
    appEvents.emit('show-modal', {
      templateHtml: '<org-switcher dismiss="dismiss()"></org-switcher>',
    });
  };

  render() {
    const { link, user } = this.props;
    return (
      <div className="sidemenu-item dropdown dropup">
        <a href={link.url} className="sidemenu-link" target={link.target}>
          <span className="icon-circle sidemenu-icon">
            {link.icon && <i className={link.icon} />}
            {link.img && <img src={link.img} />}
          </span>
        </a>
        <ul className="dropdown-menu dropdown-menu--sidemenu" role="menu">
          {link.subTitle && (
            <li className="sidemenu-subtitle">
              <span className="sidemenu-item-text">{link.subTitle}</span>
            </li>
          )}
          {link.showOrgSwitcher && (
            <li className="sidemenu-org-switcher">
              <a onClick={this.switchOrg}>
                <div>
                  <div className="sidemenu-org-switcher__org-name">{user.orgName}</div>
                  <div className="sidemenu-org-switcher__org-current">Current Org:</div>
                </div>
                <div className="sidemenu-org-switcher__switch">
                  <i className="fa fa-fw fa-random" />
                  Switch
                </div>
              </a>
            </li>
          )}
          {link.children &&
            link.children.map((child, index) => {
              if (!child.hideFromMenu) {
                return (
                  <li key={`${child.text}-${index}`}>
                    <a href={child.url} target={child.target} onClick={event => this.itemClicked(event, child)}>
                      {child.icon && <i className={child.icon} />}
                      {child.text}
                    </a>
                  </li>
                );
              }
              return null;
            })}
          <li className="side-menu-header">
            <span className="sidemenu-item-text">{link.text}</span>
          </li>
        </ul>
      </div>
    );
  }
}

export default BottomNavLinks;
