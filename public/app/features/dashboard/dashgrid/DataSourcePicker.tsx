import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';

import { DataSourceSelectItem } from 'app/types';

interface Props {
  onChangeDataSource: (ds: any) => void;
  datasources: DataSourceSelectItem[];
}

interface State {
  searchQuery: string;
}

export class DataSourcePicker extends PureComponent<Props, State> {
  searchInput: HTMLElement;

  constructor(props) {
    super(props);
    this.state = {
      searchQuery: '',
    };
  }

  getDataSources() {
    const { searchQuery } = this.state;
    const regex = new RegExp(searchQuery, 'i');
    const { datasources } = this.props;

    const filtered = datasources.filter(item => {
      return regex.test(item.name) || regex.test(item.meta.name);
    });

    return filtered;
  }

  renderDataSource = (ds: DataSourceSelectItem, index: number) => {
    const { onChangeDataSource } = this.props;
    const onClick = () => onChangeDataSource(ds);
    const cssClass = classNames({
      'ds-picker-list__item': true,
    });

    return (
      <div key={index} className={cssClass} title={ds.name} onClick={onClick}>
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

  onSearchQueryChange = evt => {
    const value = evt.target.value;
    this.setState(prevState => ({
      ...prevState,
      searchQuery: value,
    }));
  };

  renderFilters() {
    const { searchQuery } = this.state;
    return (
      <>
        <label className="gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input width-13"
            placeholder=""
            ref={elem => (this.searchInput = elem)}
            onChange={this.onSearchQueryChange}
            value={searchQuery}
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
