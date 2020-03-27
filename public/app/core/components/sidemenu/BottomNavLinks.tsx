import React, { PureComponent } from 'react';
import { css } from 'emotion';
import appEvents from '../../app_events';
import { User } from '../../services/context_srv';
import { NavModelItem, GrafanaTheme } from '@grafana/data';
import { Icon, IconName, withTheme, Themeable, stylesFactory } from '@grafana/ui';
import { CoreEvents } from 'app/types';
import { OrgSwitcher } from '../OrgSwitcher';
import { getFooterLinks } from '../Footer/Footer';

export interface Props extends Themeable {
  link: NavModelItem;
  user: User;
}

interface State {
  showSwitcherModal: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    subMenuIcon: css`
      margin-right: ${theme.spacing.sm};
      margin-bottom: ${theme.spacing.xxs};
    `,
    color: theme.isLight ? theme.colors.gray95 : theme.colors.gray4,
  };
});

class UnThemedBottomNavLinks extends PureComponent<Props, State> {
  state: State = {
    showSwitcherModal: false,
  };

  onOpenShortcuts = () => {
    appEvents.emit(CoreEvents.showModal, {
      templateHtml: '<help-modal></help-modal>',
    });
  };

  toggleSwitcherModal = () => {
    this.setState(prevState => ({
      showSwitcherModal: !prevState.showSwitcherModal,
    }));
  };

  render() {
    const { link, user, theme } = this.props;
    const { showSwitcherModal } = this.state;

    const styles = getStyles(theme);

    let children = link.children || [];

    if (link.id === 'help') {
      children = getFooterLinks();
    }

    return (
      <div className="sidemenu-item dropdown dropup">
        <a href={link.url} className="sidemenu-link" target={link.target}>
          <span className="icon-circle sidemenu-icon">
            {link.icon && <Icon name={link.icon as IconName} size="xl" color={styles.color} />}
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
              <a onClick={this.toggleSwitcherModal}>
                <div>
                  <div className="sidemenu-org-switcher__org-name">{user.orgName}</div>
                  <div className="sidemenu-org-switcher__org-current">Current Org:</div>
                </div>
                <div className="sidemenu-org-switcher__switch">
                  <Icon name="arrow-random" size="lg" className={styles.subMenuIcon} />
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
                  {child.icon && <Icon name={child.icon as IconName} size="lg" className={styles.subMenuIcon} />}
                  {child.text}
                </a>
              </li>
            );
          })}

          {link.id === 'help' && (
            <li key="keyboard-shortcuts">
              <a onClick={() => this.onOpenShortcuts()}>
                <Icon name="keyboard" size="lg" className={styles.subMenuIcon} /> Keyboard shortcuts
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

export default withTheme(UnThemedBottomNavLinks);
