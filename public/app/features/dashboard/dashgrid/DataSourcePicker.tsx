// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';

// Components
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import { Option, SingleValue } from 'app/core/components/Picker/PickerOption';
import IndicatorsContainer from 'app/core/components/Picker/IndicatorsContainer';
import Select from 'react-select';

// Types
import { DataSourceSelectItem } from 'app/types';

export interface Props {
  onChangeDataSource: (ds: DataSourceSelectItem) => void;
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
    this.props.onChangeDataSource(ds);
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
          classNamePrefix={`gf-form-select-box`}
          isMulti={false}
          menuShouldScrollIntoView={false}
          isClearable={false}
          className="gf-form-input gf-form-input--form-dropdown ds-picker"
          onChange={item => this.onChange(item)}
          options={options}
          styles={ResetStyles}
          autoFocus={autoFocus}
          onBlur={onBlur}
          openMenuOnFocus={true}
          maxMenuHeight={500}
          placeholder="Select datasource"
          loadingMessage={() => 'Loading datasources...'}
          noOptionsMessage={() => 'No datasources found'}
          value={value}
          components={{
            Option,
            SingleValue,
            IndicatorsContainer,
          }}
        />
      </div>
    );
  }
}

export default DataSourcePicker;
