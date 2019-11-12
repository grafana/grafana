// Libraries
import React, { PureComponent } from 'react';

// Components
import { Select } from '@grafana/ui';
import { SelectableValue, DataSourceSelectItem } from '@grafana/data';

export interface Props {
  onChange: (ds: DataSourceSelectItem) => void;
  datasources: DataSourceSelectItem[];
  current: DataSourceSelectItem;
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  showLoading?: boolean;
}

export class DataSourcePicker extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    autoFocus: false,
    openMenuOnFocus: false,
  };

  searchInput: HTMLElement;

  constructor(props: Props) {
    super(props);
  }

  onChange = (item: SelectableValue<string>) => {
    const ds = this.props.datasources.find(ds => ds.name === item.value);
    this.props.onChange(ds);
  };

  render() {
    const { datasources, current, autoFocus, hideTextValue, onBlur, openMenuOnFocus, showLoading } = this.props;

    const options = datasources.map(ds => ({
      value: ds.name,
      label: ds.name,
      imgUrl: ds.meta.info.logos.small,
    }));

    const value = current && {
      label: current.name.substr(0, 37),
      value: current.name,
      imgUrl: current.meta.info.logos.small,
      loading: showLoading,
      hideText: hideTextValue,
    };

    return (
      <div className="gf-form-inline">
        <Select
          className="ds-picker"
          isMulti={false}
          isClearable={false}
          backspaceRemovesValue={false}
          onChange={this.onChange}
          options={options}
          autoFocus={autoFocus}
          onBlur={onBlur}
          openMenuOnFocus={openMenuOnFocus}
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
