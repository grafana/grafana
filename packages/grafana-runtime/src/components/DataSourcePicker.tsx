// Libraries
import React, { PureComponent } from 'react';

// Components
import {
  DataSourceInstanceSettings,
  DataSourceRef,
  getDataSourceUID,
  isUnsignedPluginSignature,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ActionMeta, HorizontalGroup, PluginSignatureBadge, Select } from '@grafana/ui';

import { getDataSourceSrv } from '../services/dataSourceSrv';

import { ExpressionDatasourceRef } from './../utils/DataSourceWithBackend';

/**
 * Component props description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null; // uid
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
  /** If true,we show only DSs with logs; and if true, pluginId shouldnt be passed in */
  logs?: boolean;
  // If set to true and there is no value select will be empty, otherwise it will preselect default data source
  noDefault?: boolean;
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
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

  onChange = (item: SelectableValue<string>, actionMeta: ActionMeta) => {
    if (actionMeta.action === 'clear' && this.props.onClear) {
      this.props.onClear();
      return;
    }

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
        label: ds.name.slice(0, 37),
        value: ds.uid,
        imgUrl: ds.meta.info.logos.small,
        hideText: hideTextValue,
        meta: ds.meta,
      };
    }

    const uid = getDataSourceUID(current);

    if (uid === ExpressionDatasourceRef.uid || uid === ExpressionDatasourceRef.name) {
      return { label: uid, value: uid, hideText: hideTextValue };
    }

    return {
      label: (uid ?? 'no name') + ' - not found',
      value: uid ?? undefined,
      imgUrl: '',
      hideText: hideTextValue,
    };
  }

  getDataSourceOptions() {
    const { alerting, tracing, metrics, mixed, dashboard, variables, annotations, pluginId, type, filter, logs } =
      this.props;

    const options = this.dataSourceSrv
      .getList({
        alerting,
        tracing,
        metrics,
        logs,
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
    const {
      autoFocus,
      onBlur,
      onClear,
      openMenuOnFocus,
      placeholder,
      width,
      inputId,
      disabled = false,
      isLoading = false,
    } = this.props;
    const { error } = this.state;
    const options = this.getDataSourceOptions();
    const value = this.getCurrentValue();
    const isClearable = typeof onClear === 'function';

    return (
      <div aria-label={selectors.components.DataSourcePicker.container}>
        <Select
          isLoading={isLoading}
          disabled={disabled}
          aria-label={selectors.components.DataSourcePicker.inputV2}
          inputId={inputId || 'data-source-picker'}
          className="ds-picker select-container"
          isMulti={false}
          isClearable={isClearable}
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
          invalid={Boolean(error) || Boolean(this.props.invalid)}
          getOptionLabel={(o) => {
            if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
              return (
                <HorizontalGroup align="center" justify="space-between" height="auto">
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
