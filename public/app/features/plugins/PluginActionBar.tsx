import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import LayoutSelector, { LayoutMode } from '../../core/components/LayoutSelector/LayoutSelector';
import { setLayoutMode, setPluginsSearchQuery } from './state/actions';
import { getPluginsSearchQuery, getLayoutMode } from './state/selectors';

export interface Props {
  searchQuery: string;
  layoutMode: LayoutMode;
  setLayoutMode: typeof setLayoutMode;
  setPluginsSearchQuery: typeof setPluginsSearchQuery;
}

export class PluginActionBar extends PureComponent<Props> {
  onSearchQueryChange = event => {
    this.props.setPluginsSearchQuery(event.target.value);
  };

  render() {
    const { searchQuery, layoutMode, setLayoutMode } = this.props;

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
          <LayoutSelector mode={layoutMode} onLayoutModeChanged={(mode: LayoutMode) => setLayoutMode(mode)} />
        </div>
        <div className="page-action-bar__spacer" />
        <a
          className="btn btn-success"
          href="https://grafana.com/plugins?utm_source=grafana_plugin_list"
          target="_blank"
        >
          Find more plugins on Grafana.com
        </a>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    searchQuery: getPluginsSearchQuery(state.plugins),
    layoutMode: getLayoutMode(state.plugins),
  };
}

const mapDispatchToProps = {
  setPluginsSearchQuery,
  setLayoutMode,
};

export default connect(mapStateToProps, mapDispatchToProps)(PluginActionBar);
