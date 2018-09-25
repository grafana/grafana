import React from 'react';

export default function({ searchQuery, onQueryChange }) {
  return (
    <div className="page-action-bar">
      <div className="gf-form gf-form--grow">
        <label className="gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input width-20"
            value={searchQuery}
            onChange={onQueryChange}
            placeholder="Filter by name or type"
          />
          <i className="gf-form-input-icon fa fa-search" />
        </label>
      </div>
      <div className="page-action-bar__spacer" />
      <a className="btn btn-success" href="https://grafana.com/plugins?utm_source=grafana_plugin_list" target="_blank">
        Find more plugins on Grafana.com
      </a>
    </div>
  );
}
