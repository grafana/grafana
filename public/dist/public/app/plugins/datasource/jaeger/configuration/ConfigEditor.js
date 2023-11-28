import { css } from '@emotion/css';
import React from 'react';
import { ConfigSection, DataSourceDescription } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings, useStyles2 } from '@grafana/ui';
import { Divider } from 'app/core/components/Divider';
import { NodeGraphSection } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSection } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricsSection } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { SpanBarSection } from 'app/features/explore/TraceView/components/settings/SpanBarSettings';
import { TraceIdTimeParams } from './TraceIdTimeParams';
export const ConfigEditor = ({ options, onOptionsChange }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(DataSourceDescription, { dataSourceName: "Jaeger", docsLink: "https://grafana.com/docs/grafana/latest/datasources/jaeger", hasRequiredFields: false }),
        React.createElement(Divider, null),
        React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:16686", dataSourceConfig: options, showAccessOptions: false, onChange: onOptionsChange, secureSocksDSProxyEnabled: config.secureSocksDSProxyEnabled }),
        React.createElement(TraceToLogsSection, { options: options, onOptionsChange: onOptionsChange }),
        React.createElement(Divider, null),
        config.featureToggles.traceToMetrics ? (React.createElement(React.Fragment, null,
            React.createElement(TraceToMetricsSection, { options: options, onOptionsChange: onOptionsChange }),
            React.createElement(Divider, null))) : null,
        React.createElement(ConfigSection, { title: "Additional settings", description: "Additional settings are optional settings that can be configured for more control over your data source.", isCollapsible: true, isInitiallyOpen: false },
            React.createElement(NodeGraphSection, { options: options, onOptionsChange: onOptionsChange }),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(SpanBarSection, { options: options, onOptionsChange: onOptionsChange }),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(TraceIdTimeParams, { options: options, onOptionsChange: onOptionsChange }))));
};
const getStyles = (theme) => ({
    container: css `
    label: container;
    margin-bottom: ${theme.spacing(2)};
    max-width: 900px;
  `,
});
//# sourceMappingURL=ConfigEditor.js.map