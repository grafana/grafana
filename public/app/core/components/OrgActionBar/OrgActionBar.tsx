import React, { PureComponent } from 'react';
import LayoutSelector, { LayoutMode } from '../LayoutSelector/LayoutSelector';

export interface Props {
  searchQuery: string;
  layoutMode?: LayoutMode;
  onSetLayoutMode?: (mode: LayoutMode) => {};
  setSearchQuery: (value: string) => {};
  linkButton: { href: string; title: string };
  target?: string;
}

export default class OrgActionBar extends PureComponent<Props> {
  render() {
    const { searchQuery, layoutMode, onSetLayoutMode, linkButton, setSearchQuery, target } = this.props;
    const linkProps = { href: linkButton.href, target: undefined };

    if (target) {
      linkProps.target = target;
    }

    return (
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow">
          <label className="gf-form--has-input-icon">
            <input
              type="text"
              className="gf-form-input width-20"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Filter by name or type"
            />
            <i className="gf-form-input-icon fa fa-search" />
          </label>
          <LayoutSelector mode={layoutMode} onLayoutModeChanged={(mode: LayoutMode) => onSetLayoutMode(mode)} />
        </div>
        <div className="page-action-bar__spacer" />
        <a className="btn btn-success" {...linkProps}>
          {linkButton.title}
        </a>
      </div>
    );
  }
}
