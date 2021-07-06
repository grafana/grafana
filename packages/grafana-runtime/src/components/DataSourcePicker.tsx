// Libraries
import React, { PureComponent } from 'react';

// Components
import { HorizontalGroup, PluginSignatureBadge, Select, stylesFactory } from '@grafana/ui';
import { DataSourceInstanceSettings, isUnsignedPluginSignature, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '../services/dataSourceSrv';
import { css, cx } from '@emotion/css';

/**
 * Component props description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: string | null;
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: string;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  noDefault?: boolean;
  width?: number;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
}

/**
 * Component state description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerState {
  error?: string;
}

/**
 * Component to be able to select a datasource from the list of installed and enabled
 * datasources in the current Grafana instance.
 *
 * @internal
 */
export class DataSourcePicker extends PureComponent<DataSourcePickerProps, DataSourcePickerState> {
  dataSourceSrv = getDataSourceSrv();

  static defaultProps: Partial<DataSourcePickerProps> = {
    autoFocus: false,
    openMenuOnFocus: false,
    placeholder: 'Select data source',
  };

  state: DataSourcePickerState = {};

  constructor(props: DataSourcePickerProps) {
    super(props);
  }

  componentDidMount() {
    const { current } = this.props;
    const dsSettings = this.dataSourceSrv.getInstanceSettings(current);
    if (!dsSettings) {
      this.setState({ error: 'Could not find data source ' + current });
    }
  }

  onChange = (item: SelectableValue<string>) => {
    const dsSettings = this.dataSourceSrv.getInstanceSettings(item.value);

    if (dsSettings) {
      this.props.onChange(dsSettings);
      this.setState({ error: undefined });
    }
  };

  private getCurrentValue(): SelectableValue<string> | undefined {
    const { current, hideTextValue, noDefault } = this.props;

    if (!current && noDefault) {
      return;
    }

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
      label: (current ?? 'no name') + ' - not found',
      value: current === null ? undefined : current,
      imgUrl: '',
      hideText: hideTextValue,
    };
  }

  getDataSourceOptions() {
    const { alerting, tracing, metrics, mixed, dashboard, variables, annotations, pluginId, type, filter } = this.props;
    const options = this.dataSourceSrv
      .getList({
        alerting,
        tracing,
        metrics,
        dashboard,
        mixed,
        variables,
        annotations,
        pluginId,
        filter,
        type,
      })
      .map((ds) => ({
        value: ds.name,
        label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      }));

    return options;
  }

  render() {
    const { autoFocus, onBlur, openMenuOnFocus, placeholder, width } = this.props;
    const { error } = this.state;
    const options = this.getDataSourceOptions();
    const value = this.getCurrentValue();
    const styles = getStyles();

    return (
      <div aria-label={selectors.components.DataSourcePicker.container}>
        <Select
          className={styles.select}
          isMulti={false}
          isClearable={false}
          backspaceRemovesValue={false}
          onChange={this.onChange}
          options={options}
          autoFocus={autoFocus}
          onBlur={onBlur}
          width={width}
          openMenuOnFocus={openMenuOnFocus}
          maxMenuHeight={500}
          placeholder={placeholder}
          noOptionsMessage="No datasources found"
          value={value ?? null}
          invalid={!!error}
          getOptionLabel={(o) => {
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

const getStyles = stylesFactory(() => ({
  select: cx(
    css({
      minWidth: 200,
    }),
    'ds-picker',
    'select-container'
  ),
}));
