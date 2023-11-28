import React, { useState } from 'react';
import { getDataSourceUID, isUnsignedPluginSignature, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { HorizontalGroup, PluginSignatureBadge, MultiSelect } from '@grafana/ui';
import { isDataSourceManagingAlerts } from '../../utils/datasource';
export const MultipleDataSourcePicker = (props) => {
    const dataSourceSrv = getDataSourceSrv();
    const [state, setState] = useState();
    const onChange = (items, actionMeta) => {
        var _a;
        if (actionMeta.action === 'clear' && props.onClear) {
            props.onClear();
            return;
        }
        const selectedItem = items[items.length - 1];
        let dataSourceName, action;
        if (actionMeta.action === 'pop-value' || actionMeta.action === 'remove-value') {
            const castedActionMeta = actionMeta;
            dataSourceName = (_a = castedActionMeta.removedValue) === null || _a === void 0 ? void 0 : _a.value;
            action = 'remove';
        }
        else {
            dataSourceName = selectedItem.value;
            action = 'add';
        }
        const dsSettings = dataSourceSrv.getInstanceSettings(dataSourceName);
        if (dsSettings) {
            props.onChange(dsSettings, action);
            setState({ error: undefined });
        }
    };
    const getCurrentValue = () => {
        const { current, hideTextValue, noDefault } = props;
        if (!current && noDefault) {
            return;
        }
        return current === null || current === void 0 ? void 0 : current.map((dataSourceName) => {
            const ds = dataSourceSrv.getInstanceSettings(dataSourceName);
            if (ds) {
                return {
                    label: ds.name.slice(0, 37),
                    value: ds.name,
                    imgUrl: ds.meta.info.logos.small,
                    hideText: hideTextValue,
                    meta: ds.meta,
                };
            }
            const uid = getDataSourceUID(dataSourceName);
            if (uid === ExpressionDatasourceRef.uid || uid === ExpressionDatasourceRef.name) {
                return { label: uid, value: uid, hideText: hideTextValue };
            }
            return {
                label: (uid !== null && uid !== void 0 ? uid : 'no name') + ' - not found',
                value: uid !== null && uid !== void 0 ? uid : undefined,
                imgUrl: '',
                hideText: hideTextValue,
            };
        });
    };
    const getDataSourceOptions = () => {
        const { alerting, tracing, metrics, mixed, dashboard, variables, annotations, pluginId, type, filter, logs } = props;
        const dataSources = dataSourceSrv.getList({
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
        const alertManagingDs = dataSources.filter(isDataSourceManagingAlerts).map((ds) => ({
            value: ds.name,
            label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
        }));
        const nonAlertManagingDs = dataSources
            .filter((ds) => !isDataSourceManagingAlerts(ds))
            .map((ds) => ({
            value: ds.name,
            label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
        }));
        const groupedOptions = [
            { label: 'Data sources with configured alert rules', options: alertManagingDs, expanded: true },
            { label: 'Other data sources', options: nonAlertManagingDs, expanded: true },
        ];
        return groupedOptions;
    };
    const { autoFocus, onBlur, onClear, openMenuOnFocus, placeholder, width, inputId, disabled = false, isLoading = false, } = props;
    const options = getDataSourceOptions();
    const value = getCurrentValue();
    const isClearable = typeof onClear === 'function';
    return (React.createElement("div", { "data-testid": selectors.components.DataSourcePicker.container },
        React.createElement(MultiSelect, { isLoading: isLoading, disabled: disabled, "data-testid": selectors.components.DataSourcePicker.inputV2, inputId: inputId || 'data-source-picker', className: "ds-picker select-container", isClearable: isClearable, backspaceRemovesValue: true, onChange: onChange, options: options, autoFocus: autoFocus, onBlur: onBlur, width: width, openMenuOnFocus: openMenuOnFocus, maxMenuHeight: 500, placeholder: placeholder, noOptionsMessage: "No datasources found", value: value !== null && value !== void 0 ? value : [], invalid: Boolean(state === null || state === void 0 ? void 0 : state.error) || Boolean(props.invalid), getOptionLabel: (o) => {
                if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
                    return (React.createElement(HorizontalGroup, { align: "center", justify: "space-between", height: "auto" },
                        React.createElement("span", null, o.label),
                        " ",
                        React.createElement(PluginSignatureBadge, { status: o.meta.signature })));
                }
                return o.label || '';
            } })));
};
//# sourceMappingURL=MultipleDataSourcePicker.js.map