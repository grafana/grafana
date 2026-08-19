// Libraries
import { type ComponentType, memo } from 'react';

// Components
import {
  type DataSourceInstanceSettings,
  getDataSourceUID,
  isUnsignedPluginSignature,
  type SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type DataSourceRef } from '@grafana/schema';
import { type ActionMeta, PluginSignatureBadge, Select, Stack } from '@grafana/ui';

import { getDataSourceSrv } from '../services/dataSourceSrv';

import { ExpressionDatasourceRef, isExpressionReference } from './../utils/expressionRef';

/**
 * Component props description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | undefined | null; // uid
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

type DataSourcePickerComponentType = ComponentType<DataSourcePickerProps>;

let DataSourcePickerComponent: DataSourcePickerComponentType | undefined;

type DataSourcePickerSelection = string | DataSourceRef | DataSourceInstanceSettings | null | undefined;

/**
 * Config/provisioning can set a data source the UI picker would never offer
 * (e.g. Tempo in a Prometheus-only field). Callers should pass `resolved` as
 * undefined when `noDefault` is set and nothing is selected, so a fallback
 * default is not treated as the current value.
 *
 * @internal
 */
export function isDataSourceCompatibleWithPicker(
  selected: DataSourcePickerSelection,
  resolved: DataSourceInstanceSettings | undefined,
  allowed: DataSourceInstanceSettings[]
): boolean {
  // Expressions are valid query datasources but are not returned by getList().
  if (isExpressionReference(selected) || isExpressionReference(resolved)) {
    return true;
  }
  if (!resolved) {
    return selected == null || selected === '';
  }
  // Template refs keep the variable string as uid (`$ds`, `${ds}`, `logs-${stage}-loki`)
  // and the concrete datasource in rawRef. Match only the interpolated uid: getList({ variables: true })
  // injects `${name}` after type filters, so matching the wrapper uid would treat a Tempo-backed
  // ${ds} as valid in a Prometheus field. `$name`, interpolated names, and section-scoped refs
  // are also absent from that injected list.
  const uidToMatch = resolved.rawRef?.uid ?? resolved.uid;
  return allowed.some((ds) => ds.uid === uidToMatch);
}

/**
 * Used to bootstrap the DataSourcePicker during application start, so the
 * picker exposed to plugins renders the core Grafana implementation.
 *
 * @internal
 */
export function setDataSourcePicker(component: DataSourcePickerComponentType | undefined) {
  DataSourcePickerComponent = component;
}

/**
 * Component to be able to select a datasource from the list of installed and enabled
 * datasources in the current Grafana instance.
 *
 * @internal
 */
export function DataSourcePicker(props: DataSourcePickerProps) {
  if (DataSourcePickerComponent) {
    return <DataSourcePickerComponent {...props} />;
  }

  return <LegacyDataSourcePicker {...props} />;
}

/**
 * The original Select-based data source picker implementation. Rendered by
 * {@link DataSourcePicker} when no implementation has been set via
 * {@link setDataSourcePicker}, and by core Grafana when the
 * `grafana.unifiedDataSourcePicker` feature toggle is disabled.
 *
 * @internal
 */
export const LegacyDataSourcePicker = memo(function LegacyDataSourcePicker({
  onChange,
  current = null,
  hideTextValue,
  onBlur,
  autoFocus = false,
  openMenuOnFocus = false,
  placeholder = 'Select data source',
  tracing,
  mixed,
  dashboard,
  metrics,
  type,
  annotations,
  variables,
  alerting,
  pluginId,
  logs,
  noDefault,
  width,
  inputId,
  filter,
  onClear,
  invalid,
  disabled = false,
  isLoading = false,
}: DataSourcePickerProps) {
  const dataSourceSrv = getDataSourceSrv();
  const currentSettings = !current && noDefault ? undefined : dataSourceSrv.getInstanceSettings(current);
  const allowed = dataSourceSrv.getList({
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
  });
  const isCurrentCompatible = isDataSourceCompatibleWithPicker(current, currentSettings, allowed);

  function handleChange(item: SelectableValue<string>, actionMeta: ActionMeta) {
    if (actionMeta.action === 'clear' && onClear) {
      onClear();
      return;
    }
    const dsSettings = dataSourceSrv.getInstanceSettings(item.value);
    if (dsSettings) {
      onChange(dsSettings);
    }
  }

  function getCurrentValue(): SelectableValue<string> | undefined {
    if (!current && noDefault) {
      return;
    }
    if (currentSettings) {
      return {
        label: currentSettings.name,
        value: currentSettings.uid,
        imgUrl: currentSettings.meta.info.logos.small,
        hideText: hideTextValue,
        meta: currentSettings.meta,
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

  const options = allowed.map((ds) => ({
    value: ds.uid,
    label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
    imgUrl: ds.meta.info.logos.small,
    meta: ds.meta,
  }));
  const value = getCurrentValue();
  const isClearable = typeof onClear === 'function';
  const isInvalid = Boolean(invalid) || !isCurrentCompatible;

  return (
    <div aria-label="Data source picker select container" data-testid={selectors.components.DataSourcePicker.container}>
      <Select
        isLoading={isLoading}
        disabled={disabled}
        aria-label={'Select a data source'}
        aria-invalid={isInvalid}
        data-testid={selectors.components.DataSourcePicker.inputV2}
        inputId={inputId || 'data-source-picker'}
        className="ds-picker select-container"
        isMulti={false}
        isClearable={isClearable}
        backspaceRemovesValue={false}
        onChange={handleChange}
        options={options}
        autoFocus={autoFocus}
        onBlur={onBlur}
        width={width}
        openMenuOnFocus={openMenuOnFocus}
        maxMenuHeight={500}
        placeholder={placeholder}
        noOptionsMessage="No datasources found"
        value={value ?? null}
        invalid={isInvalid}
        getOptionLabel={(o) => {
          if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
            return (
              <Stack alignItems="center" justifyContent="space-between">
                <span>{o.label}</span> <PluginSignatureBadge status={o.meta.signature} />
              </Stack>
            );
          }
          return o.label || '';
        }}
      />
    </div>
  );
});
