import { css } from '@emotion/css';
import React, { useState } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Icon, useTheme2 } from '@grafana/ui';
import { config } from '../../../../../../core/config';
import { downloadTraceAsJson } from '../../../../../inspector/utils/download';
import ActionButton from './ActionButton';
export const getStyles = (theme) => {
    return {
        TracePageActions: css `
      label: TracePageActions;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    `,
        feedback: css `
      margin: 6px;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      &:hover {
        color: ${theme.colors.text.link};
      }
    `,
    };
};
export default function TracePageActions(props) {
    const { traceId, data, app } = props;
    const theme = useTheme2();
    const styles = getStyles(theme);
    const [copyTraceIdClicked, setCopyTraceIdClicked] = useState(false);
    const copyTraceId = () => {
        navigator.clipboard.writeText(traceId);
        setCopyTraceIdClicked(true);
        setTimeout(() => {
            setCopyTraceIdClicked(false);
        }, 5000);
    };
    const exportTrace = () => {
        const traceFormat = downloadTraceAsJson(data, 'Trace-' + traceId.substring(traceId.length - 6));
        reportInteraction('grafana_traces_download_traces_clicked', {
            app,
            grafana_version: config.buildInfo.version,
            trace_format: traceFormat,
            location: 'trace-view',
        });
    };
    return (React.createElement("div", { className: styles.TracePageActions },
        React.createElement("a", { href: "https://forms.gle/RZDEx8ScyZNguDoC8", className: styles.feedback, title: "Share your thoughts about tracing in Grafana.", target: "_blank", rel: "noreferrer noopener" },
            React.createElement(Icon, { name: "comment-alt-message" }),
            " Give feedback"),
        React.createElement(ActionButton, { onClick: copyTraceId, ariaLabel: 'Copy Trace ID', label: copyTraceIdClicked ? 'Copied!' : 'Trace ID', icon: 'copy' }),
        React.createElement(ActionButton, { onClick: exportTrace, ariaLabel: 'Export Trace', label: 'Export', icon: 'save' })));
}
//# sourceMappingURL=TracePageActions.js.map