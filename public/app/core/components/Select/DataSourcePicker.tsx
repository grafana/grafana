// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';

// Components
import Select from './Select';

// Types
import { DataSourceSelectItem } from 'app/types';

export interface Props {
  onChange: (ds: DataSourceSelectItem) => void;
  datasources: DataSourceSelectItem[];
  current: DataSourceSelectItem;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export class DataSourcePicker extends PureComponent<Props> {
  static defaultProps = {
    autoFocus: false,
  };

  searchInput: HTMLElement;

  constructor(props) {
    super(props);
  }

  onChange = item => {
    const ds = this.props.datasources.find(ds => ds.name === item.value);
    this.props.onChange(ds);
  };

  render() {
    const { datasources, current, autoFocus, onBlur } = this.props;

    const options = datasources.map(ds => ({
      value: ds.name,
      label: ds.name,
      imgUrl: ds.meta.info.logos.small,
    }));

    const value = current && {
      label: current.name,
      value: current.name,
      imgUrl: current.meta.info.logos.small,
    };

    return (
      <div className="gf-form-inline">
        <Select
          isMulti={false}
          isClearable={false}
          backspaceRemovesValue={false}
          onChange={this.onChange}
          options={options}
          autoFocus={autoFocus}
          onBlur={onBlur}
          openMenuOnFocus={true}
          maxMenuHeight={500}
          placeholder="Select datasource"
          noOptionsMessage={() => 'No datasources found'}
          value={value}
        />
      </div>
    );
  }
}

export default DataSourcePicker;
