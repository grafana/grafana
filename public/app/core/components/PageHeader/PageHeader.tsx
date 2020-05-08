import React, { FormEvent } from 'react';
import { css } from 'emotion';
import { Tab, TabsBar, Icon, IconName } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { NavModel, NavModelItem, NavModelBreadcrumb } from '@grafana/data';
import { CoreEvents } from 'app/types';

export interface Props {
  model: NavModel;
}

const SelectNav = ({ children, customCss }: { children: NavModelItem[]; customCss: string }) => {
  if (!children || children.length === 0) {
    return null;
  }

  const defaultSelectedItem = children.find(navItem => {
    return navItem.active === true;
  });

  const gotoUrl = (evt: FormEvent) => {
    const element = evt.target as HTMLSelectElement;
    const url = element.options[element.selectedIndex].value;
    appEvents.emit(CoreEvents.locationChange, { href: url });
  };

  return (
    <div className={`gf-form-select-wrapper width-20 ${customCss}`}>
      <label
        className={`gf-form-select-icon ${defaultSelectedItem ? defaultSelectedItem?.icon : ''}`}
        htmlFor="page-header-select-nav"
      />
      {/* Label to make it clickable */}
      <select
        className="gf-select-nav gf-form-input"
        value={defaultSelectedItem?.url ?? ''}
        onChange={gotoUrl}
        id="page-header-select-nav"
      >
        {children.map((navItem: NavModelItem) => {
          if (navItem.hideFromTabs) {
            // TODO: Rename hideFromTabs => hideFromNav
            return null;
          }
          return (
            <option key={navItem.url} value={navItem.url}>
              {navItem.text}
            </option>
          );
        })}
      </select>
    </div>
  );
};

const Navigation = ({ children }: { children: NavModelItem[] }) => {
  if (!children || children.length === 0) {
    return null;
  }

  const goToUrl = (index: number) => {
    children.forEach((child, i) => {
      if (i === index) {
        appEvents.emit(CoreEvents.locationChange, { href: child.url });
      }
    });
  };

  return (
    <nav>
      <SelectNav customCss="page-header__select-nav" children={children} />
      <TabsBar className="page-header__tabs" hideBorder={true}>
        {children.map((child, index) => {
          return (
            !child.hideFromTabs && (
              <Tab
                label={child.text}
                active={child.active}
                key={`${child.url}-${index}`}
                icon={child.icon as IconName}
                onChangeTab={() => goToUrl(index)}
              />
            )
          );
        })}
      </TabsBar>
    </nav>
  );
};

export default class PageHeader extends React.Component<Props, any> {
  constructor(props: Props) {
    super(props);
  }

  shouldComponentUpdate() {
    //Hack to re-render on changed props from angular with the @observer decorator
    return true;
  }

  renderTitle(title: string, breadcrumbs: NavModelBreadcrumb[]) {
    if (!title && (!breadcrumbs || breadcrumbs.length === 0)) {
      return null;
    }

    if (!breadcrumbs || breadcrumbs.length === 0) {
      return <h1 className="page-header__title">{title}</h1>;
    }

    const breadcrumbsResult = [];
    for (const bc of breadcrumbs) {
      if (bc.url) {
        breadcrumbsResult.push(
          <a className="text-link" key={breadcrumbsResult.length} href={bc.url}>
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

  renderHeaderTitle(main: NavModelItem) {
    const iconClassName =
      main.icon === 'grafana'
        ? css`
            margin-top: 12px;
          `
        : css`
            margin-top: 14px;
          `;

    return (
      <div className="page-header__inner">
        <span className="page-header__logo">
          {main.icon && <Icon name={main.icon as IconName} size="xxxl" className={iconClassName} />}
          {main.img && <img className="page-header__img" src={main.img} />}
        </span>

        <div className="page-header__info-block">
          {this.renderTitle(main.text, main.breadcrumbs ?? [])}
          {main.subTitle && <div className="page-header__sub-title">{main.subTitle}</div>}
        </div>
      </div>
    );
  }

  render() {
    const { model } = this.props;

    if (!model) {
      return null;
    }

    const main = model.main;
    const children = main.children;

    return (
      <div className="page-header-canvas">
        <div className="page-container">
          <div className="page-header">
            {this.renderHeaderTitle(main)}
            {children && children.length && <Navigation children={children} />}
          </div>
        </div>
      </div>
    );
  }
}
