import React, { PureComponent } from 'react';
import config from 'app/core/config';

export interface Props {}
export interface State {
  user: {};
  bottomNav: any[];
  mainLinks: any[];
  isSignedIn: boolean;
  loginUrl: string;
}

export class SideMenu extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    const navTree = config.bootData.navTree;

    this.state = {
      mainLinks: navTree.filter(item => {
        return !item.hideFromMenu;
      }),
      isSignedIn: true,
      loginUrl: '',
      user: {},
      bottomNav: [],
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
    const { mainLinks, isSignedIn, loginUrl, bottomNav } = this.state;

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
      <div className="sidemenu__top">
        {mainLinks.map((link, index) => {
          return (
            <a className="sidemenu-link" href={link.url} target={link.target} key={`${link.id}-${index}`}>
              <span className="icon-circle sidemenu-icon">
                <i className={link.icon} />
                {link.img && <img src={link.img} />}
              </span>
            </a>
          );
        })}
      </div>,
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
                {link.children.map(child => {
                  if (!child.hideFromMenu) {
                    return (
                      <li className={child.divider}>
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
