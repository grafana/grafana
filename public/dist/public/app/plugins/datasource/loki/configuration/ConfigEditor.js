import React, { useCallback } from 'react';
import { ConfigSection, DataSourceDescription, ConnectionSettings, Auth, convertLegacyAuthProps, AdvancedHttpSettings, } from '@grafana/experimental';
import { config, reportInteraction } from '@grafana/runtime';
import { SecureSocksProxySettings } from '@grafana/ui';
import { Divider } from 'app/core/components/Divider';
import { AlertingSettings } from './AlertingSettings';
import { DerivedFields } from './DerivedFields';
import { QuerySettings } from './QuerySettings';
const makeJsonUpdater = (field) => (options, value) => {
    return Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { [field]: value }) });
};
const setMaxLines = makeJsonUpdater('maxLines');
const setPredefinedOperations = makeJsonUpdater('predefinedOperations');
const setDerivedFields = makeJsonUpdater('derivedFields');
export const ConfigEditor = (props) => {
    const { options, onOptionsChange } = props;
    const updatePredefinedOperations = useCallback((value) => {
        reportInteraction('grafana_loki_predefined_operations_changed', { value });
        onOptionsChange(setPredefinedOperations(options, value));
    }, [options, onOptionsChange]);
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceDescription, { dataSourceName: "Loki", docsLink: "https://grafana.com/docs/grafana/latest/datasources/loki/configure-loki-data-source/", hasRequiredFields: false }),
        React.createElement(Divider, null),
        React.createElement(ConnectionSettings, { config: options, onChange: onOptionsChange, urlPlaceholder: "http://localhost:3100" }),
        React.createElement(Divider, null),
        React.createElement(Auth, Object.assign({}, convertLegacyAuthProps({
            config: options,
            onChange: onOptionsChange,
        }))),
        React.createElement(Divider, null),
        React.createElement(ConfigSection, { title: "Additional settings", description: "Additional settings are optional settings that can be configured for more control over your data source.", isCollapsible: true, isInitiallyOpen: true },
            React.createElement(AdvancedHttpSettings, { config: options, onChange: onOptionsChange }),
            React.createElement(Divider, { hideLine: true }),
            config.secureSocksDSProxyEnabled && (React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange })),
            React.createElement(AlertingSettings, { options: options, onOptionsChange: onOptionsChange }),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(QuerySettings, { maxLines: options.jsonData.maxLines || '', onMaxLinedChange: (value) => onOptionsChange(setMaxLines(options, value)), predefinedOperations: options.jsonData.predefinedOperations || '', onPredefinedOperationsChange: updatePredefinedOperations }),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(DerivedFields, { fields: options.jsonData.derivedFields, onChange: (value) => onOptionsChange(setDerivedFields(options, value)) }))));
};
//# sourceMappingURL=ConfigEditor.js.map