import { css } from '@emotion/css';
import React from 'react';
import { AdvancedHttpSettings, Auth, ConfigSection, ConfigSubSection, ConnectionSettings, convertLegacyAuthProps, DataSourceDescription, } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { SecureSocksProxySettings, useStyles2 } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
import { Divider } from 'app/core/components/Divider';
import { NodeGraphSection } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSection } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricsSection } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { SpanBarSection } from 'app/features/explore/TraceView/components/settings/SpanBarSettings';
import { LokiSearchSettings } from './LokiSearchSettings';
import { QuerySettings } from './QuerySettings';
import { ServiceGraphSettings } from './ServiceGraphSettings';
import { TraceQLSearchSettings } from './TraceQLSearchSettings';
export const ConfigEditor = ({ options, onOptionsChange }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(DataSourceDescription, { dataSourceName: "Tempo", docsLink: "https://grafana.com/docs/grafana/latest/datasources/tempo", hasRequiredFields: false }),
        React.createElement(Divider, null),
        React.createElement(ConnectionSettings, { config: options, onChange: onOptionsChange, urlPlaceholder: "http://localhost:3200" }),
        React.createElement(Divider, null),
        React.createElement(Auth, Object.assign({}, convertLegacyAuthProps({
            config: options,
            onChange: onOptionsChange,
        }))),
        React.createElement(Divider, null),
        React.createElement(TraceToLogsSection, { options: options, onOptionsChange: onOptionsChange }),
        React.createElement(Divider, null),
        config.featureToggles.traceToMetrics ? (React.createElement(React.Fragment, null,
            React.createElement(TraceToMetricsSection, { options: options, onOptionsChange: onOptionsChange }),
            React.createElement(Divider, null))) : null,
        React.createElement(ConfigSection, { title: "Additional settings", description: "Additional settings are optional settings that can be configured for more control over your data source.", isCollapsible: true, isInitiallyOpen: false },
            React.createElement(AdvancedHttpSettings, { config: options, onChange: onOptionsChange }),
            config.secureSocksDSProxyEnabled && (React.createElement(React.Fragment, null,
                React.createElement(Divider, { hideLine: true }),
                React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange }))),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(ConfigSubSection, { title: "Service graph", description: React.createElement(ConfigDescriptionLink, { description: "Select a Prometheus data source that contains the service graph data.", suffix: "tempo/#service-graph", feature: "the service graph" }) },
                React.createElement(ServiceGraphSettings, { options: options, onOptionsChange: onOptionsChange })),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(NodeGraphSection, { options: options, onOptionsChange: onOptionsChange }),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(ConfigSubSection, { title: "Tempo search", description: React.createElement(ConfigDescriptionLink, { description: "Modify how traces are searched.", suffix: "tempo/#tempo-search", feature: "Tempo search" }) },
                React.createElement(TraceQLSearchSettings, { options: options, onOptionsChange: onOptionsChange })),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(ConfigSubSection, { title: "Loki search", description: React.createElement(ConfigDescriptionLink, { description: "Select a Loki data source to search for traces. Derived fields must be configured in the Loki data source.", suffix: "tempo/#loki-search", feature: "Loki search" }) },
                React.createElement(LokiSearchSettings, { options: options, onOptionsChange: onOptionsChange })),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(ConfigSubSection, { title: "TraceID query", description: React.createElement(ConfigDescriptionLink, { description: "Modify how TraceID queries are run.", suffix: "tempo/#traceid-query", feature: "the TraceID query" }) },
                React.createElement(QuerySettings, { options: options, onOptionsChange: onOptionsChange })),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(SpanBarSection, { options: options, onOptionsChange: onOptionsChange }))));
};
const getStyles = (theme) => ({
    container: css `
    label: container;
    margin-bottom: ${theme.spacing(2)};
    max-width: 900px;
  `,
});
//# sourceMappingURL=ConfigEditor.js.map