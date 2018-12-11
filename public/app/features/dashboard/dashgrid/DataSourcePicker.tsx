import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
import KeyboardNavigation, { KeyboardNavigationProps } from './KeyboardNavigation';
import { DataSourceSelectItem } from 'app/types';

export interface Props {
  onChangeDataSource: (ds: DataSourceSelectItem) => void;
  datasources: DataSourceSelectItem[];
  current: DataSourceSelectItem;
}

interface State {
  searchQuery: string;
  isOpen: boolean;
}

export class DataSourcePicker extends PureComponent<Props, State> {
  searchInput: HTMLElement;

  constructor(props) {
    super(props);

    this.state = {
      searchQuery: '',
      isOpen: false,
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

  get maxSelectedIndex() {
    const filtered = this.getDataSources();
    return filtered.length - 1;
  }

  renderDataSource = (ds: DataSourceSelectItem, index: number, keyNavProps: KeyboardNavigationProps) => {
    const { onChangeDataSource } = this.props;
    const { selected, onMouseEnter } = keyNavProps;
    const onClick = () => onChangeDataSource(ds);
    const isSelected = selected === index;
    const cssClass = classNames({
      'ds-picker-list__item': true,
      'ds-picker-list__item--selected': isSelected,
    });
    return (
      <div key={index} className={cssClass} title={ds.name} onClick={onClick} onMouseEnter={() => onMouseEnter(index)}>
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

  renderFilters({ onKeyDown, selected }: KeyboardNavigationProps) {
    const { searchQuery } = this.state;
    return (
      <label className="gf-form--has-input-icon">
        <input
          type="text"
          className="gf-form-input width-13"
          placeholder=""
          ref={elem => (this.searchInput = elem)}
          onChange={this.onSearchQueryChange}
          value={searchQuery}
          onKeyDown={evt => {
            onKeyDown(evt, this.maxSelectedIndex, () => {
              const { onChangeDataSource } = this.props;
              const ds = this.getDataSources()[selected];
              onChangeDataSource(ds);
            });
          }}
        />
        <i className="gf-form-input-icon fa fa-search" />
      </label>
    );
  }

  onOpen = () => {
    this.setState({ isOpen: true });
  };

  render() {
    const { current } = this.props;
    const { isOpen } = this.state;

    return (
      <div className="ds-picker">
        {!isOpen && (
          <div className="toolbar__main" onClick={this.onOpen}>
            <img className="toolbar__main-image" src={current.meta.info.logos.small} />
            <div className="toolbar__main-name">{current.name}</div>
            <i className="fa fa-caret-down" />
          </div>
        )}
        {isOpen && (
          <KeyboardNavigation
            render={(keyNavProps: KeyboardNavigationProps) => (
              <div className="ds-picker-menu">
                <div className="cta-form__bar">
                  {this.renderFilters(keyNavProps)}
                  <div className="gf-form--grow" />
                </div>
                <div className="ds-picker-list">
                  {this.getDataSources().map((ds, index) => this.renderDataSource(ds, index, keyNavProps))}
                </div>
              </div>
            )}
          />
        )}
      </div>
    );
  }
}

export default DataSourcePicker;
