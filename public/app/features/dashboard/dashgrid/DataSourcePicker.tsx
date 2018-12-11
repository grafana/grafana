import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
import withKeyboardNavigation from './withKeyboardNavigation';
import { DataSourceSelectItem } from 'app/types';

export interface Props {
  onChangeDataSource: (ds: any) => void;
  datasources: DataSourceSelectItem[];
  selected?: number;
  onKeyDown?: (evt: any, maxSelectedIndex: number, onEnterAction: () => void) => void;
  onMouseEnter?: (select: number) => void;
}

interface State {
  searchQuery: string;
}

export const DataSourcePicker = withKeyboardNavigation(
  class DataSourcePicker extends PureComponent<Props, State> {
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

    get maxSelectedIndex() {
      const filtered = this.getDataSources();
      return filtered.length - 1;
    }

    renderDataSource = (ds: DataSourceSelectItem, index: number) => {
      const { onChangeDataSource, selected, onMouseEnter } = this.props;
      const onClick = () => onChangeDataSource(ds);
      const isSelected = selected === index;
      const cssClass = classNames({
        'ds-picker-list__item': true,
        'ds-picker-list__item--selected': isSelected,
      });
      return (
        <div
          key={index}
          className={cssClass}
          title={ds.name}
          onClick={onClick}
          onMouseEnter={() => onMouseEnter(index)}
        >
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
      const { onKeyDown } = this.props;
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
              onKeyDown={evt => {
                onKeyDown(evt, this.maxSelectedIndex, () => {
                  const { onChangeDataSource, selected } = this.props;
                  const ds = this.getDataSources()[selected];
                  onChangeDataSource(ds);
                });
              }}
            />
            <i className="gf-form-input-icon fa fa-search" />
          </label>
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
);

export default DataSourcePicker;
