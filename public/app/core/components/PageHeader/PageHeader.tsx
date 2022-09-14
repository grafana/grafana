import { css } from '@emotion/css';
import React, { FC } from 'react';

import { NavModelItem, NavModelBreadcrumb, GrafanaTheme2 } from '@grafana/data';
import { Tab, TabsBar, Icon, useStyles2, toIconName } from '@grafana/ui';
import { PanelHeaderMenuItem } from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderMenuItem';

import { ProBadge } from '../Upgrade/ProBadge';

export interface Props {
  navItem: NavModelItem;
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
        <div className="gf-form-input dropdown-toggle" data-toggle="dropdown">
          {defaultSelectedItem?.text}
        </div>
        <ul className="dropdown-menu dropdown-menu--menu">
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

export const PageHeader: FC<Props> = ({ navItem: model }) => {
  const styles = useStyles2(getStyles);

  if (!model) {
    return null;
  }

  return (
    <div className={styles.headerCanvas}>
      <div className="page-container">
        <div className="page-header">
          {renderHeaderTitle(model)}
          {model.children && model.children.length > 0 && <Navigation>{model.children}</Navigation>}
        </div>
      </div>
    </div>
  );
};

function renderHeaderTitle(main: NavModelItem) {
  const marginTop = main.icon === 'grafana' ? 12 : 14;
  const icon = main.icon && toIconName(main.icon);

  return (
    <div className="page-header__inner">
      <span className="page-header__logo">
        {icon && <Icon name={icon} size="xxxl" style={{ marginTop }} />}
        {main.img && <img className="page-header__img" src={main.img} alt={`logo of ${main.text}`} />}
      </span>

      <div className="page-header__info-block">
        {renderTitle(main.text, main.breadcrumbs ?? [], main.highlightText)}
        {main.subTitle && <div className="page-header__sub-title">{main.subTitle}</div>}
      </div>
    </div>
  );
}

function renderTitle(title: string, breadcrumbs: NavModelBreadcrumb[], highlightText: NavModelItem['highlightText']) {
  if (!title && (!breadcrumbs || breadcrumbs.length === 0)) {
    return null;
  }

  if (!breadcrumbs || breadcrumbs.length === 0) {
    return (
      <h1 className="page-header__title">
        {title}
        {highlightText && (
          <ProBadge
            text={highlightText}
            className={css`
              vertical-align: middle;
            `}
          />
        )}
      </h1>
    );
  }

  const breadcrumbsResult = [];
  for (const bc of breadcrumbs) {
    if (bc.url) {
      breadcrumbsResult.push(
        <a className="page-header__link" key={breadcrumbsResult.length} href={bc.url}>
          {bc.title}
        </a>
      );
    } else {
      breadcrumbsResult.push(<span key={breadcrumbsResult.length}> / {bc.title}</span>);
    }
  }
  breadcrumbsResult.push(<span key={breadcrumbs.length + 1}> / {title}</span>);

  return <h1 className="page-header__title">{breadcrumbsResult}</h1>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  headerCanvas: css`
    background: ${theme.colors.background.canvas};
  `,
});
