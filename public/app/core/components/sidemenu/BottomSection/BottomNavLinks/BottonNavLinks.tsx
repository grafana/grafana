import React, { SFC } from 'react';
import appEvents from '../../../../app_events';

interface BottonNavLinksProps {
  link: any;
}

const BottomNavLinks: SFC<BottonNavLinksProps> = props => {
  const { link } = props;

  const itemClicked = (event, item) => {
    event.preventDefault();
    if (item.url === '/shortcuts') {
      appEvents.emit('show-modal', {
        templateHtml: '<help-modal></help-modal>',
      });
    }
  };

  const switchOrg = () => {
    console.log('switch org yo');
  };

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
            <span className="sidemenu-item-text">{link.subTitle}}</span>
          </li>
        )}
        {link.showOrgSwitcher && (
          <li className="sidemenu-org-switcher">
            <div onClick={switchOrg}>
              <div>
                <div className="sidemenu-org-switcher__org-name">{`555-555555`}</div>
                <div className="sidemenu-org-switcher__org-current">Current Org:</div>
              </div>
              <div className="sidemenu-org-switcher__switch">
                <i className="fa fa-fw fa-random" />Switch
              </div>
            </div>
          </li>
        )}
        {link.children.map((child, index) => {
          if (!child.hideFromMenu) {
            return (
              <li className={child.divider} key={`${child.text}-${index}`}>
                <a href={child.url} target={child.target} onClick={event => itemClicked(event, child)}>
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
};

export default BottomNavLinks;
