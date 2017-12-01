import React from 'react';
import { NavModel, NavModelItem } from '../nav_model_srv';
import classNames from 'classnames';

export interface IProps {
  model: NavModel;
}

// function BreadcrumbItem(item: NavModelItem) {
//   return (
//     <a className="breadcrumb-item" href={item.url} key={item.id}>
//       {item.text}
//     </a>
//   );
// }
//
// function Breadcrumb(model: NavModel) {
//   return (
//     <div className="page-nav">
//       <div className="page-breadcrumbs">
//         <a className="breadcrumb-item active" href="/">
//           <i className="fa fa-home" />
//         </a>
//         {model.breadcrumbs.map(BreadcrumbItem)}
//       </div>
//     </div>
//   );
// }

function TabItem(tab: NavModelItem) {
  if (tab.hideFromTabs || tab.divider) {
    return (null);
  }

  let tabClasses = classNames({
    'gf-tabs-link': true,
    active: tab.active,
  });

  return (
    <li className="gf-tabs-item" key={tab.url}>
      <a className={tabClasses} href={tab.url}>
        <i className={tab.icon} />
        {tab.text}
      </a>
    </li>
  );
}

function Tabs({main}: {main: NavModelItem}) {
  return <ul className="gf-tabs">{main.children.map(TabItem)}</ul>;
}

export default class PageHeader extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  renderHeaderTitle(main) {
    return (
      <div className="page-header__inner">
        <span className="page-header__logo">
          {main.icon && <i className={`page-header__icon ${main.icon}`} />}
          {main.img && <img className="page-header__img" src={main.img} />}
        </span>

        <div className="page-header__info-block">
          <h1 className="page-header__title">{main.text}</h1>
          {main.subTitle && <div className="page-header__sub-title">{main.subTitle}</div>}
          {main.subType && (
            <div className="page-header__stamps">
              <i className={main.subType.icon} />
              {main.subType.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="page-header-canvas">
        <div className="page-container">
          <div className="page-header">
            {this.renderHeaderTitle(this.props.model.main)}

            {this.props.model.main.children && <Tabs main={this.props.model.main} />}
          </div>
        </div>
      </div>
    );
  }
}
