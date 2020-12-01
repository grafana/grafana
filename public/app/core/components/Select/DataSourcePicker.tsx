// Libraries
import React, { PureComponent } from 'react';

// Components
import { HorizontalGroup, Select } from '@grafana/ui';
import { SelectableValue, DataSourceSelectItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { isUnsignedPluginSignature, PluginSignatureBadge } from '../../../features/plugins/PluginSignatureBadge';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

export interface Props {
  onChange: (ds: DataSourceSelectItem) => void;
  current: string | null;
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: string;
  invalid?: boolean;
}

export class DataSourcePicker extends PureComponent<Props> {
  dataSourceSrv = getDatasourceSrv();
  static defaultProps: Partial<Props> = {
    autoFocus: false,
    openMenuOnFocus: false,
    placeholder: 'Select datasource',
  };

  constructor(props: Props) {
    super(props);
  }

  onChange = (item: SelectableValue<string>) => {
    const ds = this.dataSourceSrv.getInstanceSettings(item.value);

    if (ds) {
      this.props.onChange({
        value: ds.isDefault ? null : ds.name,
        name: ds.name,
        meta: ds.meta,
        sort: '',
      });
    }
  };

  private getCurrentValue() {
    const { current, hideTextValue } = this.props;
    const ds = this.dataSourceSrv.getInstanceSettings(current);

    if (ds) {
      return {
        label: ds.name.substr(0, 37),
        value: ds.name,
        imgUrl: ds.meta.info.logos.small,
        hideText: hideTextValue,
        meta: ds.meta,
      };
    }

    return {
      label: (current ?? 'no name') + ' (not found)',
      value: current,
      imgUrl: '',
      hideText: hideTextValue,
    };
  }

  render() {
    const { autoFocus, onBlur, openMenuOnFocus, placeholder, invalid } = this.props;

    const options = this.dataSourceSrv.getMetricSources().map(ds => ({
      value: ds.name,
      label: ds.name,
      imgUrl: ds.meta.info.logos.small,
      meta: ds.meta,
    }));

    const value = this.getCurrentValue();

    return (
      <div aria-label={selectors.components.DataSourcePicker.container}>
        <Select
          className="ds-picker select-container"
          isMulti={false}
          isClearable={false}
          backspaceRemovesValue={false}
          onChange={this.onChange}
          options={options}
          autoFocus={autoFocus}
          onBlur={onBlur}
          openMenuOnFocus={openMenuOnFocus}
          maxMenuHeight={500}
          menuPlacement="bottom"
          placeholder={placeholder}
          noOptionsMessage="No datasources found"
          value={value}
          invalid={invalid}
          getOptionLabel={o => {
            if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
              return (
                <HorizontalGroup align="center" justify="space-between">
                  <span>{o.label}</span> <PluginSignatureBadge status={o.meta.signature} />
                </HorizontalGroup>
              );
            }
            return o.label || '';
          }}
        />
      </div>
    );
  }
}

export default DataSourcePicker;
