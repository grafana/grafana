import { css, cx } from '@emotion/css';
import * as React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { Tab, TabsBar, Icon, useStyles2, toIconName } from '@grafana/ui';

import { PageInfoItem } from '../../../core/components/Page/types';
import { PageInfo } from '../../../core/components/PageInfo/PageInfo';
import { ProBadge } from '../../../core/components/Upgrade/ProBadge';

import { PanelHeaderMenuItem } from './PanelHeaderMenuItem';

export interface Props {
  navItem: NavModelItem;
  renderTitle?: (title: string) => React.ReactNode;
  actions?: React.ReactNode;
  info?: PageInfoItem[];
  subTitle?: React.ReactNode;
}

const SelectNav = ({ children, customCss }: { children: NavModelItem[]; customCss: string }) => {
  if (!children || children.length === 0) {
    return null;
  }

  const defaultSelectedItem = children.find((navItem) => {
    return navItem.active === true;
  });

  return (
    <div className={`gf-form-select-wrapper width-20 ${customCss}`}>
      <div className="dropdown">
        <button
          type="button"
          className="gf-form-input dropdown-toggle"
          data-toggle="dropdown"
          style={{ textAlign: 'left' }}
        >
          {defaultSelectedItem?.text}
        </button>
        <ul role="menu" className="dropdown-menu dropdown-menu--menu">
          {children.map((navItem: NavModelItem) => {
            if (navItem.hideFromTabs) {
              // TODO: Rename hideFromTabs => hideFromNav
              return null;
            }
            return (
              <PanelHeaderMenuItem
                key={navItem.url}
                iconClassName={navItem.icon}
                text={navItem.text}
                href={navItem.url}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const Navigation = ({ children }: { children: NavModelItem[] }) => {
  if (!children || children.length === 0) {
    return null;
  }

  return (
    <nav>
      <SelectNav customCss="page-header__select-nav">{children}</SelectNav>
      <TabsBar className="page-header__tabs" hideBorder={true}>
        {children.map((child, index) => {
          return (
            !child.hideFromTabs && (
              <Tab
                label={child.text}
                active={child.active}
                key={`${child.url}-${index}`}
                icon={child.icon}
                href={child.url}
                suffix={child.tabSuffix}
              />
            )
          );
        })}
      </TabsBar>
    </nav>
  );
};

export const PageHeader = ({ navItem: model, renderTitle, actions, info, subTitle }: Props) => {
  const styles = useStyles2(getStyles);

  if (!model) {
    return null;
  }

  const renderHeader = (main: NavModelItem) => {
    const marginTop = main.icon === 'grafana' ? 12 : 14;
    const icon = main.icon && toIconName(main.icon);
    const sub = subTitle ?? main.subTitle;

    return (
      <div className="page-header__inner">
        <span className="page-header__logo">
          {icon && <Icon name={icon} size="xxxl" style={{ marginTop }} />}
          {main.img && <img className="page-header__img" src={main.img} alt="" />}
        </span>

        <div className={cx('page-header__info-block', styles.headerText)}>
          {renderTitle ? renderTitle(main.text) : renderHeaderTitle(main.text, main.highlightText)}
          {info && <PageInfo info={info} />}
          {sub && <div className="page-header__sub-title">{sub}</div>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.headerCanvas}>
      <div className="page-container">
        <div className="page-header">
          {renderHeader(model)}
          {model.children && model.children.length > 0 && <Navigation>{model.children}</Navigation>}
        </div>
      </div>
    </div>
  );
};

function renderHeaderTitle(title: string, highlightText: NavModelItem['highlightText']) {
  if (!title) {
    return null;
  }

  return (
    <h1 className="page-header__title">
      {title}
      {highlightText && (
        <ProBadge
          text={highlightText}
          className={css({
            verticalAlign: 'middle',
          })}
        />
      )}
    </h1>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  actions: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
  }),
  headerText: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  headerCanvas: css({
    background: theme.colors.background.canvas,
  }),
});
