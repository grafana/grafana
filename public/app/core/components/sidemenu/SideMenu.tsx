import React, { PureComponent } from 'react';
import _ from 'lodash';
import SideMenuTop from './sideMenuTop/SideMenuTop';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';

export interface Props {}
export interface State {
  user: {};
  bottomNav: any[];
  mainLinks: any[];
  isSignedIn: boolean;
}

export class SideMenu extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    const navTree = _.cloneDeep(config.bootData.navTree);

    this.state = {
      mainLinks: _.filter(navTree, item => !item.hideFromMenu),
      bottomNav: _.filter(navTree, item => item.hideFromMenu),
      isSignedIn: contextSrv.isSignedIn,
      user: contextSrv.user,
    };
  }

  toggleSideMenuSmallBreakpoint = event => {
    console.log(event);
    console.log('pushed me');
  };

  itemClicked = event => {
    console.log(event);
    console.log('clicked me');
  };

  render() {
    const { mainLinks, isSignedIn, bottomNav } = this.state;

    const loginUrl = `login?redirect=${encodeURIComponent(window.location.pathname)}`;

    return [
      <a className="sidemenu__logo" href="/">
        <img src="public/img/grafana_icon.svg" alt="graphana_logo" />
      </a>,
      <div className="sidemenu__logo_small_breakpoint" onClick={this.toggleSideMenuSmallBreakpoint}>
        <i className="fa fa-bars" />
        <span className="sidemenu__close">
          <i className="fa fa-times" />&nbsp;Close
        </span>
      </div>,
      <SideMenuTop mainLinks={mainLinks} />,
      <div className="sidemenu__bottom">
        {!isSignedIn && (
          <div className="sidemen-item">
            <a href={loginUrl} className="sidemenu-link">
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
        )}
        <div className="sidemenu-item dropdown dropup">
          {bottomNav.map((link, index) => {
            return [
              <a key={index} href={link.url} className="sidemenu-link" target={link.target}>
                <span className="icon-circle sidemenu-icon">
                  {link.icon && <i className={link.icon} />}
                  {link.img && <img src={link.img} />}
                </span>
              </a>,
              <ul key={index} className="dropdown-menu dropdown-menu--sidemenu" role="menu">
                {link.subTitle && (
                  <li className="sidemenu-subtitle">
                    <span className="sidemenu-item-text">{link.subTitle}}</span>
                  </li>
                )}
                {link.showOrgSwitcher && (
                  <li className="sidemenu-org-switcher">
                    <a ng-click="ctrl.switchOrg()">
                      <div>
                        <div className="sidemenu-org-switcher__org-name">{`555-555555`}</div>
                        <div className="sidemenu-org-switcher__org-current">Current Org:</div>
                      </div>
                      <div className="sidemenu-org-switcher__switch">
                        <i className="fa fa-fw fa-random" />Switch
                      </div>
                    </a>
                  </li>
                )}
                {link.children.map((child, index) => {
                  if (!child.hideFromMenu) {
                    return (
                      <li className={child.divider} key={`${child.text}-${index}`}>
                        <a href={child.url} target={child.target} onClick={this.itemClicked}>
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
              </ul>,
            ];
          })}
        </div>
      </div>,
    ];
  }
}
