import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';

import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DataSourceSelectItem } from 'app/types';

interface Props {}

interface State {
  datasources: DataSourceSelectItem[];
  searchQuery: string;
}

export class DataSourcePicker extends PureComponent<Props, State> {
  searchInput: HTMLElement;

  constructor(props) {
    super(props);

    this.state = {
      datasources: getDatasourceSrv().getMetricSources(),
      searchQuery: '',
    };
  }

  getDataSources() {
    const { datasources, searchQuery } = this.state;
    const regex = new RegExp(searchQuery, 'i');

    const filtered = datasources.filter(item => {
      return regex.test(item.name) || regex.test(item.meta.name);
    });

    return _.sortBy(filtered, 'sort');
  }

  renderDataSource = (ds: DataSourceSelectItem, index) => {
    const cssClass = classNames({
      'ds-picker-list__item': true,
    });

    return (
      <div key={index} className={cssClass} title={ds.name}>
        <img className="ds-picker-list__img" src={ds.meta.info.logos.small} />
        <div className="ds-picker-list__name">{ds.name}</div>
      </div>
    );
  };

  componentDidMount() {
    setTimeout(() => {
      this.searchInput.focus();
    }, 300);
  }

  renderFilters() {
    return (
      <>
        <label className="gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input width-13"
            placeholder=""
            ref={elem => (this.searchInput = elem)}
          />
          <i className="gf-form-input-icon fa fa-search" />
        </label>
        <div className="p-l-1">
          <button className="btn toggle-btn gf-form-btn active">All</button>
          <button className="btn toggle-btn gf-form-btn">Favorites</button>
        </div>
      </>
    );
  }

  render() {
    return (
      <>
        <div className="cta-form__bar">
          {this.renderFilters()}
          <div className="gf-form--grow" />
        </div>
        <div className="ds-picker-list">{this.getDataSources().map(this.renderDataSource)}</div>
      </>
    );
  }
}
