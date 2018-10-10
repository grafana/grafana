import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import LayoutSelector, { LayoutMode } from '../../core/components/LayoutSelector/LayoutSelector';
import { setDataSourcesLayoutMode, setDataSourcesSearchQuery } from './state/actions';
import { getDataSourcesLayoutMode, getDataSourcesSearchQuery } from './state/selectors';

export interface Props {
  searchQuery: string;
  layoutMode: LayoutMode;
  setDataSourcesLayoutMode: typeof setDataSourcesLayoutMode;
  setDataSourcesSearchQuery: typeof setDataSourcesSearchQuery;
}

export class DataSourcesActionBar extends PureComponent<Props> {
  onSearchQueryChange = event => {
    this.props.setDataSourcesSearchQuery(event.target.value);
  };

  render() {
    const { searchQuery, layoutMode, setDataSourcesLayoutMode } = this.props;

    return (
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow">
          <label className="gf-form--has-input-icon">
            <input
              type="text"
              className="gf-form-input width-20"
              value={searchQuery}
              onChange={this.onSearchQueryChange}
              placeholder="Filter by name or type"
            />
            <i className="gf-form-input-icon fa fa-search" />
          </label>
          <LayoutSelector
            mode={layoutMode}
            onLayoutModeChanged={(mode: LayoutMode) => setDataSourcesLayoutMode(mode)}
          />
        </div>
        <div className="page-action-bar__spacer" />
        <a className="page-header__cta btn btn-success" href="datasources/new">
          Add data source
        </a>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    searchQuery: getDataSourcesSearchQuery(state.dataSources),
    layoutMode: getDataSourcesLayoutMode(state.dataSources),
  };
}

const mapDispatchToProps = {
  setDataSourcesLayoutMode,
  setDataSourcesSearchQuery,
};

export default connect(mapStateToProps, mapDispatchToProps)(DataSourcesActionBar);
